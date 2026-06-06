#!/usr/bin/env node
import { findPatternFiles, PATTERNS } from './lib/patterns.js';
import { getRepoRoot } from './lib/repo-root.js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pattern-search.js "<pattern-name>" [--path dir]');
  console.error(`Available patterns: ${[...PATTERNS.keys()].join(', ')}`);
  process.exit(1);
}

let patternName = null;
let searchPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--path' && args[i + 1]) {
    searchPath = args[++i];
  } else if (!args[i].startsWith('--')) {
    patternName = args[i];
  }
}

if (!patternName) {
  console.error('Error: pattern name is required');
  process.exit(1);
}

if (!PATTERNS.has(patternName)) {
  console.error(`Unknown pattern: ${patternName}`);
  console.error(`Available: ${[...PATTERNS.keys()].join(', ')}`);
  process.exit(1);
}

const cwd = getRepoRoot();
const searchDir = searchPath ? (searchPath.startsWith('/') ? searchPath : `${cwd}/${searchPath}`) : cwd;

try {
  const results = findPatternFiles(searchDir, patternName);
  console.log(JSON.stringify({
    pattern: patternName,
    description: PATTERNS.get(patternName).description,
    files: results,
    totalFiles: results.length,
    totalMatches: results.reduce((sum, f) => sum + f.matches.length, 0),
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
