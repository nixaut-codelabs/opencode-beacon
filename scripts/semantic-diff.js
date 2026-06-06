#!/usr/bin/env node
// Called by: semantic file comparison
// Input: "file1" "file2" [--threshold F]
// Output: JSON with semantic diff (added, removed, modified chunks)

import { Embedder } from './lib/embedder.js';
import { chunkCode } from './lib/chunker.js';
import { loadConfig } from './lib/config.js';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let file1 = null;
let file2 = null;
let thresholdOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--threshold' && args[i + 1]) {
    thresholdOverride = parseFloat(args[++i]);
  } else if (!file1) {
    file1 = args[i];
  } else if (!file2) {
    file2 = args[i];
  }
}

if (!file1 || !file2) {
  console.error('Usage: semantic-diff.js "file1" "file2" [--threshold F]');
  process.exit(1);
}

const SIMILARITY_THRESHOLD = thresholdOverride ?? 0.85;
const cwd = process.cwd();

const abs1 = path.isAbsolute(file1) ? file1 : path.join(cwd, file1);
const abs2 = path.isAbsolute(file2) ? file2 : path.join(cwd, file2);

if (!existsSync(abs1)) {
  console.error(JSON.stringify({ error: `File not found: ${file1}` }));
  process.exit(1);
}
if (!existsSync(abs2)) {
  console.error(JSON.stringify({ error: `File not found: ${file2}` }));
  process.exit(1);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const config = loadConfig();

// File size limit to prevent memory issues (100KB)
const MAX_FILE_SIZE = 100 * 1024;
const stat1 = statSync(abs1);
const stat2 = statSync(abs2);

if (stat1.size > MAX_FILE_SIZE || stat2.size > MAX_FILE_SIZE) {
  console.log(JSON.stringify({
    error: `File too large (max ${MAX_FILE_SIZE / 1024}KB). Use smaller files for semantic diff.`,
    file1_size: stat1.size,
    file2_size: stat2.size,
  }));
  process.exit(0);
}

const content1 = readFileSync(abs1, 'utf-8');
const content2 = readFileSync(abs2, 'utf-8');

const chunks1 = chunkCode(content1, file1, config);
const chunks2 = chunkCode(content2, file2, config);

if (chunks1.length === 0 && chunks2.length === 0) {
  console.log(JSON.stringify({
    file1, file2,
    diff: { added: [], removed: [], modified: [], unchanged: [] },
    summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
  }, null, 2));
  process.exit(0);
}

const embedder = new Embedder(config);

try {
  const texts1 = chunks1.map(c => c.text);
  const texts2 = chunks2.map(c => c.text);
  const allTexts = [...texts1, ...texts2];
  const allEmbeddings = await embedder.embedDocuments(allTexts);

  const emb1 = allEmbeddings.slice(0, chunks1.length);
  const emb2 = allEmbeddings.slice(chunks1.length);

  const matched2 = new Set();
  const modified = [];
  const removed = [];

  for (let i = 0; i < chunks1.length; i++) {
    let bestMatch = -1;
    let bestSim = 0;

    for (let j = 0; j < chunks2.length; j++) {
      const sim = cosineSimilarity(emb1[i], emb2[j]);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = j;
      }
    }

    if (bestSim >= SIMILARITY_THRESHOLD && bestMatch >= 0) {
      matched2.add(bestMatch);
      if (bestSim < 1.0 && chunks1[i].text !== chunks2[bestMatch].text) {
        modified.push({
          file1_lines: `${chunks1[i].startLine}-${chunks1[i].endLine}`,
          file2_lines: `${chunks2[bestMatch].startLine}-${chunks2[bestMatch].endLine}`,
          similarity: bestSim.toFixed(3),
          old_preview: chunks1[i].text.slice(0, 200),
          new_preview: chunks2[bestMatch].text.slice(0, 200),
        });
      }
    } else {
      removed.push({
        lines: `${chunks1[i].startLine}-${chunks1[i].endLine}`,
        best_match_similarity: bestSim.toFixed(3),
        preview: chunks1[i].text.slice(0, 200),
      });
    }
  }

  const added = [];
  for (let j = 0; j < chunks2.length; j++) {
    if (!matched2.has(j)) {
      let bestSim = 0;
      for (let i = 0; i < chunks1.length; i++) {
        const sim = cosineSimilarity(emb1[i], emb2[j]);
        if (sim > bestSim) bestSim = sim;
      }
      added.push({
        lines: `${chunks2[j].startLine}-${chunks2[j].endLine}`,
        best_match_similarity: bestSim.toFixed(3),
        preview: chunks2[j].text.slice(0, 200),
      });
    }
  }

  const unchanged = chunks1.length - modified.length - removed.length;

  console.log(JSON.stringify({
    file1,
    file2,
    threshold: SIMILARITY_THRESHOLD,
    diff: { added, removed, modified },
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: Math.max(0, unchanged),
    },
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
