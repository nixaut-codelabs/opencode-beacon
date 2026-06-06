#!/usr/bin/env node
import { openDatabase } from './lib/open-db.js';
import { Embedder } from './lib/embedder.js';
import { loadConfig } from './lib/config.js';
import { existsSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let topK = 10;
let maxTokens = 4000;
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--top-k' && args[i + 1]) {
    const parsed = parseInt(args[++i], 10);
    if (!isNaN(parsed) && parsed > 0) topK = parsed;
  } else if (args[i] === '--max-tokens' && args[i + 1]) {
    const parsed = parseInt(args[++i], 10);
    if (!isNaN(parsed) && parsed > 0) maxTokens = parsed;
  } else {
    positional.push(args[i]);
  }
}

const query = positional.join(' ');
if (!query) {
  console.error('Usage: context.js [--top-k N] [--max-tokens N] "<query>"');
  process.exit(1);
}

function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

function mergeAdjacentChunks(matches) {
  if (matches.length <= 1) return matches;

  const sorted = [...matches].sort((a, b) =>
    a.file.localeCompare(b.file) || a.startLine - b.startLine
  );

  const merged = [];
  let cur = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.file === cur.file && next.startLine <= cur.endLine + 5) {
      cur.endLine = Math.max(cur.endLine, next.endLine);
      cur.content = cur.content + '\n' + next.content;
      cur.score = Math.max(cur.score, next.score);
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);
  return merged.sort((a, b) => b.score - a.score);
}

const config = loadConfig();
const dbPath = path.join(config.storage.path, 'embeddings.db');

if (!existsSync(dbPath)) {
  console.log(JSON.stringify({ context: [], total_tokens: 0, error: 'No index found' }));
  process.exit(0);
}

let db;
try {
  db = openDatabase(dbPath, config.embedding.dimensions);
} catch (err) {
  console.log(JSON.stringify({ context: [], total_tokens: 0, error: err.message }));
  process.exit(1);
}

try {
  const dimCheck = db.checkDimensions();
  if (!dimCheck.ok) {
    console.log(JSON.stringify({ context: [], total_tokens: 0, error: 'Dimension mismatch' }));
    process.exit(1);
  }

  const embedder = new Embedder(config);
  let results;

  try {
    const embedding = await embedder.embedQuery(query);
    results = db.search(embedding, topK, config.search.similarity_threshold, query, config, null);
  } catch {
    results = db.ftsOnlySearch(query, topK, null);
  }

  const rawChunks = results.map(r => ({
    file: r.filePath,
    startLine: r.startLine,
    endLine: r.endLine,
    content: r.chunkText,
    score: r.score ?? r.similarity ?? 0,
  }));

  const merged = mergeAdjacentChunks(rawChunks);

  const context = [];
  let totalTokens = 0;

  for (const chunk of merged) {
    const tokens = estimateTokens(chunk.content);
    if (totalTokens + tokens > maxTokens) break;
    context.push({
      file: chunk.file,
      lines: `${chunk.startLine}-${chunk.endLine}`,
      content: chunk.content,
    });
    totalTokens += tokens;
  }

  console.log(JSON.stringify({ context, total_tokens: totalTokens }));
} catch (err) {
  console.log(JSON.stringify({ context: [], total_tokens: 0, error: err.message }));
  process.exit(1);
} finally {
  db?.close();
}
