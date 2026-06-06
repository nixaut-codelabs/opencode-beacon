#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { loadConfig } from './lib/config.js';
import { openDatabase } from './lib/open-db.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  'vendor', '__pycache__', '.venv', 'venv',
]);

const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx']);

const EXPORT_RE = /export\s+(?:async\s+)?function\s+(\w+)|export\s+(?:const|let|var)\s+(\w+)|module\.exports\.(\w+)\s*=|(\w+)\s*:\s*(?:async\s+)?function/g;
const FUNC_RE = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*\(.*\)\s*\{)/g;

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const args = process.argv.slice(2);
let typeFilter = 'all';
let pathFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    typeFilter = args[++i];
  } else if (args[i] === '--path' && args[i + 1]) {
    pathFilter = args[++i];
  }
}

const cwd = process.cwd();

function walkFiles(dir, results = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return results; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      walkFiles(full, results);
    } else if (stat.isFile() && JS_EXT.has(path.extname(full))) {
      const rel = path.relative(cwd, full);
      if (!pathFilter || rel.startsWith(pathFilter)) {
        results.push({ abs: full, rel });
      }
    }
  }
  return results;
}

function detectDeadCode() {
  const files = walkFiles(cwd);
  const exports = [];

  for (const { abs, rel } of files) {
    let content;
    try { content = readFileSync(abs, 'utf-8'); } catch { continue; }

    EXPORT_RE.lastIndex = 0;
    let match;
    while ((match = EXPORT_RE.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3] || match[4];
      if (name) {
        const line = content.slice(0, match.index).split('\n').length;
        exports.push({ name, file: rel, line });
      }
    }
  }

  const allContent = new Map();
  for (const { abs, rel } of files) {
    try { allContent.set(rel, readFileSync(abs, 'utf-8')); } catch { /* skip */ }
  }

  const dead = [];
  for (const exp of exports) {
    let importedElsewhere = false;
    // Use word boundary regex instead of substring match
    const wordRe = new RegExp(`\\b${escapeRegex(exp.name)}\\b`);
    for (const [file, content] of allContent) {
      if (file === exp.file) continue;
      if (wordRe.test(content)) {
        importedElsewhere = true;
        break;
      }
    }
    if (!importedElsewhere) {
      dead.push({
        type: 'dead-code',
        file: exp.file,
        line: exp.line,
        name: exp.name,
        severity: 'warning',
        message: `Exported '${exp.name}' is never imported in other files`,
      });
    }
  }

  return dead;
}

function detectDuplicateCode() {
  const config = loadConfig();
  const dbPath = path.join(config.storage.path, 'embeddings.db');
  if (!existsSync(dbPath)) return [];

  let db;
  try {
    db = openDatabase(dbPath, config.embedding.dimensions);
  } catch {
    return [];
  }

  try {
    // Limit chunks to prevent memory issues with large codebases
    const chunks = db.db.prepare(`
      SELECT id, file_path, chunk_text, start_line, end_line, embedding
      FROM chunks
      ORDER BY file_path, start_line
      LIMIT 1000
    `).all();

    if (chunks.length < 2) return [];

    const duplicates = [];
    const threshold = 0.9;
    const limit = Math.min(chunks.length, 500);

    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        if (chunks[i].file_path === chunks[j].file_path) continue;

        const a = new Float32Array(chunks[i].embedding.buffer || chunks[i].embedding);
        const b = new Float32Array(chunks[j].embedding.buffer || chunks[j].embedding);

        if (a.length !== b.length) continue;

        let dot = 0, normA = 0, normB = 0;
        for (let k = 0; k < a.length; k++) {
          dot += a[k] * b[k];
          normA += a[k] * a[k];
          normB += b[k] * b[k];
        }
        const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);

        if (similarity >= threshold) {
          duplicates.push({
            type: 'duplicate-code',
            file: chunks[i].file_path,
            lines: `${chunks[i].start_line}-${chunks[i].end_line}`,
            similarTo: chunks[j].file_path,
            similarLines: `${chunks[j].start_line}-${chunks[j].end_line}`,
            similarity: similarity.toFixed(3),
            severity: 'info',
            message: `Chunk similar to ${chunks[j].file_path}:${chunks[j].start_line} (${(similarity * 100).toFixed(1)}%)`,
          });
        }
      }
    }

    return duplicates;
  } finally {
    db.close();
  }
}

function detectComplexFunctions() {
  const files = walkFiles(cwd);
  const smells = [];

  for (const { abs, rel } of files) {
    let content;
    try { content = readFileSync(abs, 'utf-8'); } catch { continue; }

    const lines = content.split('\n');
    FUNC_RE.lastIndex = 0;
    let match;

    while ((match = FUNC_RE.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3] || 'anonymous';
      const startLine = content.slice(0, match.index).split('\n').length;

      let braceCount = 0;
      let endLine = startLine;
      let started = false;
      let maxNesting = 0;
      let currentNesting = 0;

      for (let i = startLine - 1; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
          if (ch === '{') {
            braceCount++;
            currentNesting++;
            started = true;
            if (currentNesting > maxNesting) maxNesting = currentNesting;
          } else if (ch === '}') {
            braceCount--;
            currentNesting--;
          }
        }
        endLine = i + 1;
        if (started && braceCount <= 0) break;
      }

      const funcLines = endLine - startLine + 1;

      if (funcLines > 50) {
        smells.push({
          type: 'complex-function',
          file: rel,
          line: startLine,
          name,
          severity: 'warning',
          message: `Function '${name}' is ${funcLines} lines long (threshold: 50)`,
        });
      }

      if (maxNesting > 4) {
        smells.push({
          type: 'deep-nesting',
          file: rel,
          line: startLine,
          name,
          severity: 'warning',
          message: `Function '${name}' has nesting depth ${maxNesting} (threshold: 4)`,
        });
      }
    }
  }

  return smells;
}

try {
  const smells = [];

  if (typeFilter === 'all' || typeFilter === 'dead') {
    smells.push(...detectDeadCode());
  }
  if (typeFilter === 'all' || typeFilter === 'duplicate') {
    smells.push(...detectDuplicateCode());
  }
  if (typeFilter === 'all' || typeFilter === 'complex') {
    smells.push(...detectComplexFunctions());
  }

  console.log(JSON.stringify(smells, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
