#!/usr/bin/env node
// Called by: multi-repository search
// Input: "query" [--repos path1,path2,...] [--top-k N]
// Output: JSON with aggregated results from multiple repos

import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let query = null;
let reposArg = null;
let topKOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repos' && args[i + 1]) {
    reposArg = args[++i];
  } else if (args[i] === '--top-k' && args[i + 1]) {
    topKOverride = parseInt(args[++i], 10);
  } else if (!query) {
    query = args[i];
  }
}

if (!query) {
  console.error('Usage: multi-repo.js "query" [--repos path1,path2,...] [--top-k N]');
  process.exit(1);
}

function resolveRepos(reposArg) {
  if (!reposArg) {
    const parent = path.resolve(__dirname, '..', '..');
    const entries = [];
    try {
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(path.join(parent, entry.name, '.opencode', 'beacon.json'))) {
          entries.push(path.join(parent, entry.name));
        }
      }
    } catch { /* skip */ }
    return entries.length > 0 ? entries : [process.cwd()];
  }
  return reposArg.split(',').map(r => {
    const trimmed = r.trim();
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
  }).filter(r => existsSync(r));
}

function searchInRepo(repoPath, queryText, topK) {
  const searchScript = path.join(__dirname, 'search.js');
  if (!existsSync(searchScript)) {
    return { error: `search.js not found at ${searchScript}` };
  }

  const searchArgs = ['--top-k', String(topK), queryText];

  const result = spawnSync(process.execPath, [searchScript, ...searchArgs], {
    cwd: repoPath,
    encoding: 'utf-8',
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'Unknown error';
    return { error: stderr };
  }

  try {
    return { results: JSON.parse(result.stdout) };
  } catch {
    return { error: 'Failed to parse search output' };
  }
}

const repos = await resolveRepos(reposArg);

if (repos.length === 0) {
  console.log(JSON.stringify({ query, repos: [], error: 'No repos found. Use --repos to specify paths.' }));
  process.exit(0);
}

const topK = topKOverride ?? 10;
const output = { query, repo_count: repos.length, repos: [] };

for (const repoPath of repos) {
  const repoName = path.basename(repoPath);
  const searchResult = searchInRepo(repoPath, query, topK);

  if (searchResult.error) {
    output.repos.push({ name: repoName, path: repoPath, error: searchResult.error, results: [] });
  } else {
    const matches = Array.isArray(searchResult.results) ? searchResult.results : [];
    output.repos.push({
      name: repoName,
      path: repoPath,
      result_count: matches.length,
      results: matches,
    });
  }
}

output.total_results = output.repos.reduce((sum, r) => sum + (r.result_count || 0), 0);

console.log(JSON.stringify(output, null, 2));
