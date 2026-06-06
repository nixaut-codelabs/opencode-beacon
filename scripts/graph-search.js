#!/usr/bin/env node
import { getDependents, getDependencies, getImpactRadius } from './lib/graph.js';
import { getRepoRoot } from './lib/repo-root.js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: graph-search.js "<file>" [--type dependents|dependencies|impact] [--depth N]');
  process.exit(1);
}

let filePath = null;
let searchType = 'dependents';
let depth = 2;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    searchType = args[++i];
  } else if (args[i] === '--depth' && args[i + 1]) {
    const parsed = parseInt(args[++i], 10);
    if (!isNaN(parsed) && parsed > 0) depth = parsed;
  } else if (!args[i].startsWith('--')) {
    filePath = args[i];
  }
}

if (!filePath) {
  console.error('Error: file path is required');
  process.exit(1);
}

const cwd = getRepoRoot();

try {
  let result;
  switch (searchType) {
    case 'dependents':
      result = { type: 'dependents', file: filePath, files: getDependents(filePath, cwd) };
      break;
    case 'dependencies':
      result = { type: 'dependencies', file: filePath, files: getDependencies(filePath, cwd) };
      break;
    case 'impact':
      result = { type: 'impact', file: filePath, depth, files: getImpactRadius(filePath, cwd, depth) };
      break;
    default:
      console.error(`Unknown type: ${searchType}. Use: dependents, dependencies, impact`);
      process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
