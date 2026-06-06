#!/usr/bin/env node
import { openDatabase } from './lib/open-db.js';
import { loadConfig } from './lib/config.js';
import { existsSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let limit = 10;
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    const parsed = parseInt(args[++i], 10);
    if (!isNaN(parsed) && parsed > 0) limit = parsed;
  } else {
    positional.push(args[i]);
  }
}

const partial = positional.join(' ').trim();
if (!partial) {
  console.log(JSON.stringify([]));
  process.exit(0);
}

const config = loadConfig();
const dbPath = path.join(config.storage.path, 'embeddings.db');

if (!existsSync(dbPath)) {
  console.log(JSON.stringify([]));
  process.exit(0);
}

let db;
try {
  db = openDatabase(dbPath, config.embedding.dimensions);
} catch {
  console.log(JSON.stringify([]));
  process.exit(0);
}

try {
  const freq = new Map();
  const safePartial = partial.replace(/[^a-zA-Z0-9_$]/g, '');
  if (!safePartial) {
    console.log(JSON.stringify([]));
    process.exit(0);
  }

  const ftsRows = db.db.prepare(`
    SELECT identifiers, chunk_text, file_path
    FROM chunks_fts
    JOIN chunks ON chunks.id = chunks_fts.rowid
    WHERE chunks_fts MATCH ?
    LIMIT 200
  `).all(`"${safePartial}"*`);

  const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g;
  const lowerPartial = partial.toLowerCase();

  for (const row of ftsRows) {
    const allIds = new Set();

    for (const match of (row.identifiers || '').matchAll(identifierPattern)) {
      allIds.add(match[0]);
    }
    for (const match of (row.chunk_text || '').matchAll(identifierPattern)) {
      allIds.add(match[0]);
    }

    const filePathParts = (row.file_path || '').split(/[\/\\._-]/);
    for (const part of filePathParts) {
      if (part.length >= 2) allIds.add(part);
    }

    for (const id of allIds) {
      if (id.toLowerCase().startsWith(lowerPartial)) {
        freq.set(id, (freq.get(id) || 0) + 1);
      }
    }
  }

  const phraseRows = db.db.prepare(`
    SELECT chunk_text FROM chunks_fts
    WHERE chunks_fts MATCH ?
    LIMIT 100
  `).all(`"${safePartial}"*`);

  const bigramFreq = new Map();
  for (const row of phraseRows) {
    const text = row.chunk_text || '';
    const words = text.split(/\s+/).filter(w => w.length >= 2);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i + 1];
      if (bigram.toLowerCase().startsWith(lowerPartial)) {
        bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
      }
    }
  }

  const fileRows = db.db.prepare(`
    SELECT DISTINCT file_path FROM chunks
    WHERE file_path LIKE ?
    LIMIT 50
  `).all(`%${safePartial}%`);

  for (const row of fileRows) {
    const fileName = row.file_path.split('/').pop();
    if (fileName.toLowerCase().includes(lowerPartial)) {
      freq.set(fileName, (freq.get(fileName) || 0) + 3);
    }
  }

  const suggestions = [];

  for (const [phrase, count] of bigramFreq) {
    suggestions.push({ text: phrase, score: count * 2 });
  }
  for (const [id, count] of freq) {
    suggestions.push({ text: id, score: count });
  }

  suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));

  const seen = new Set();
  const unique = [];
  for (const s of suggestions) {
    const lower = s.text.toLowerCase();
    if (!seen.has(lower) && unique.length < limit) {
      seen.add(lower);
      unique.push(s.text);
    }
  }

  console.log(JSON.stringify(unique));
} catch {
  console.log(JSON.stringify([]));
} finally {
  db?.close();
}
