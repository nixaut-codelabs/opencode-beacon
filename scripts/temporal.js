#!/usr/bin/env node
// Called by: temporal search queries
// Input: "query" [--since date] [--until date] [--top-k N]
// Output: JSON with search results filtered by git history date range

import { openDatabase } from './lib/open-db.js';
import { Embedder } from './lib/embedder.js';
import { loadConfig } from './lib/config.js';
import { spawnSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// Date format validation
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?$/;
function isValidDate(d) { return d && DATE_RE.test(d); }

const args = process.argv.slice(2);
let query = null;
let since = null;
let until = null;
let topKOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--since' && args[i + 1]) {
    since = args[++i];
  } else if (args[i] === '--until' && args[i + 1]) {
    until = args[++i];
  } else if (args[i] === '--top-k' && args[i + 1]) {
    topKOverride = parseInt(args[++i], 10);
  } else if (!query) {
    query = args[i];
  }
}

if (!query) {
  console.error('Usage: temporal.js "query" [--since date] [--until date] [--top-k N]');
  process.exit(1);
}

function getFilesChangedInRange(sinceDate, untilDate) {
  // Validate dates to prevent command injection
  if (sinceDate && !isValidDate(sinceDate)) {
    console.error(JSON.stringify({ error: `Invalid --since format: ${sinceDate}. Use YYYY-MM-DD` }));
    process.exit(1);
  }
  if (untilDate && untilDate !== 'now' && !isValidDate(untilDate)) {
    console.error(JSON.stringify({ error: `Invalid --until format: ${untilDate}. Use YYYY-MM-DD` }));
    process.exit(1);
  }

  const gitArgs = ['log', '--name-only', '--pretty=format:'];
  if (sinceDate) gitArgs.push(`--since=${sinceDate}`);
  if (untilDate && untilDate !== 'now') gitArgs.push(`--until=${untilDate}`);

  try {
    const result = spawnSync('git', gitArgs, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.status !== 0) return new Set();
    const files = new Set(result.stdout.split('\n').map(f => f.trim()).filter(Boolean));
    return files;
  } catch {
    return new Set();
  }
}

function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

const config = loadConfig();
const topK = topKOverride ?? config.search.top_k;
const dbPath = path.join(config.storage.path, 'embeddings.db');

if (!existsSync(dbPath)) {
  console.error('Beacon: no index found. Run sync first.');
  process.exit(1);
}

let db;
try {
  db = openDatabase(dbPath, config.embedding.dimensions);
} catch (err) {
  console.error(JSON.stringify({ error: `Failed to open database: ${err.message}` }));
  process.exit(1);
}

try {
  const dimCheck = db.checkDimensions();
  if (!dimCheck.ok) {
    console.error(JSON.stringify({
      error: `Dimension mismatch: DB has ${dimCheck.stored}d, config specifies ${dimCheck.current}d. Run /reindex.`
    }));
    process.exit(1);
  }

  const changedFiles = getFilesChangedInRange(since, until);
  const hasGitFilter = changedFiles.size > 0;

  const embedder = new Embedder(config);
  let results;
  let ftsOnly = false;

  try {
    const queryEmbedding = await embedder.embedQuery(query);
    results = db.search(queryEmbedding, topK * (hasGitFilter ? 4 : 1), config.search.similarity_threshold, query, config);
  } catch (err) {
    ftsOnly = true;
    results = db.ftsOnlySearch(query, topK * (hasGitFilter ? 4 : 1));
  }

  if (hasGitFilter) {
    results = results.filter(r => changedFiles.has(r.filePath));
  }

  results = results.slice(0, topK);

  const formatted = results.map(r => ({
    file: r.filePath,
    lines: `${r.startLine}-${r.endLine}`,
    similarity: r.similarity.toFixed(3),
    ...(r.score !== undefined ? { score: r.score.toFixed(3) } : {}),
    preview: r.chunkText.slice(0, 300),
    ...(ftsOnly ? { _note: r._note } : {}),
  }));

  console.log(JSON.stringify({
    query,
    date_range: {
      since: since || 'beginning',
      until: until || 'now',
    },
    files_in_range: hasGitFilter ? changedFiles.size : null,
    results: formatted,
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
} finally {
  db?.close();
}
