import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

export const PATTERNS = new Map([
  ['api-endpoint', {
    regex: /(?:app|router|server)\s*\.\s*(get|post|put|delete|patch|head|options)\s*\(\s*['"`/]/gi,
    description: 'HTTP route/endpoint definitions',
  }],
  ['database-query', {
    regex: /(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\s|\.query\s*\(|db\.\w+\s*\(|\.find(?:One|Many|All)?\s*\(|\.create\s*\(|\.update\s*\(|\.delete\s*\(/gi,
    description: 'Database queries and ORM calls',
  }],
  ['react-component', {
    regex: /(?:export\s+)?(?:default\s+)?(?:function|class)\s+[A-Z]\w+|(?:const|let)\s+[A-Z]\w+\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
    description: 'React component definitions',
  }],
  ['class', {
    regex: /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+\w+/g,
    description: 'Class definitions',
  }],
  ['function', {
    regex: /(?:export\s+)?(?:async\s+)?function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/g,
    description: 'Function definitions',
  }],
  ['test', {
    regex: /(?:describe|it|test)\s*\(\s*['"`]/gi,
    description: 'Test suite/block definitions',
  }],
  ['config', {
    regex: /(?:module\.exports|export\s+default|export\s+const\s+config|defineConfig)\s*[=;]/gi,
    description: 'Configuration exports',
  }],
  ['route', {
    regex: /(?:routes?|prefix|path)\s*[:=]\s*['"`/]|router\s*\.\s*(use|group)\s*\(/gi,
    description: 'Route definitions and prefixes',
  }],
]);

function walkFilesSync(dir, results = []) {
  const skipDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.cache',
    'vendor', '__pycache__', '.venv', 'venv',
  ]);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkFilesSync(full, results);
    } else if (stat.isFile() && /\.(js|ts|jsx|tsx|py|go|rs|rb|mjs|cjs|mts|cts)$/i.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

export function matchPattern(text, patternName) {
  const pattern = PATTERNS.get(patternName);
  if (!pattern) return [];

  const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
  const matches = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    if (regex.test(lines[i])) {
      matches.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
    }
  }

  return matches;
}

export function findPatternFiles(cwd, patternName) {
  const pattern = PATTERNS.get(patternName);
  if (!pattern) return [];

  const files = walkFilesSync(cwd);
  const results = [];

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const matches = matchPattern(content, patternName);
    if (matches.length > 0) {
      results.push({
        file: path.relative(cwd, file),
        matches,
      });
    }
  }

  return results;
}
