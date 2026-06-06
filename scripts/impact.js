#!/usr/bin/env node
import { buildDependencyGraph, getDependents, getImpactRadius } from './lib/graph.js';
import { getRepoRoot } from './lib/repo-root.js';

const args = process.argv.slice(2);
let filePath = null;
let depth = 2;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--depth' && args[i + 1]) {
    depth = parseInt(args[++i], 10);
    if (isNaN(depth) || depth < 1) depth = 2;
  } else if (!args[i].startsWith('--')) {
    filePath = args[i];
  }
}

if (!filePath) {
  console.error('Usage: impact.js <file-path> [--depth N]');
  process.exit(1);
}

const cwd = getRepoRoot();

try {
  // Build graph once, reuse for both calls
  const graph = buildDependencyGraph(cwd);
  const direct = getDependents(filePath, cwd, graph);
  const radius = getImpactRadius(filePath, cwd, depth, graph);

  const directSet = new Set(direct);
  const transitive = radius
    .filter(r => r.depth > 1)
    .map(r => r.file)
    .filter(f => !directSet.has(f));

  const allFiles = radius.map(r => ({ file: r.file, depth: r.depth }));
  const total = direct.length + transitive.length;
  const risk = total <= 2 ? 'low' : total <= 5 ? 'medium' : 'high';

  const result = {
    file: filePath,
    depth,
    impact: {
      direct: direct.length,
      transitive: transitive.length,
      total,
      risk,
      files: allFiles,
    },
  };

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
