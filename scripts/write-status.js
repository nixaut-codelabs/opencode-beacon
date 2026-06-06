#!/usr/bin/env node
// Writes status.json for TUI widget consumption
// Called by: sync.js after indexing completes

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function stableID(prefix, seed) {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

function getStatusFile() {
  const root = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  const scope = process.cwd();
  const dir = join(root, 'beacon-opencode', stableID('scope', scope));
  mkdirSync(dir, { recursive: true });
  return join(dir, 'status.json');
}

const args = process.argv.slice(2);
const syncStatus = args[0] || 'idle'; // idle, syncing, error

try {
  const config = loadConfig();
  const dbPath = join(config.storage.path, 'embeddings.db');
  
  let filesIndexed = 0;
  let totalChunks = 0;
  let lastSync = new Date().toISOString();
  let embeddingModel = config.embedding.model;

  if (existsSync(dbPath)) {
    const { openDatabase } = await import('./lib/open-db.js');
    const db = openDatabase(dbPath, config.embedding.dimensions);
    
    const stats = db.db.prepare(`
      SELECT 
        COUNT(DISTINCT file_path) as files,
        COUNT(*) as chunks,
        MAX(updated_at) as last_sync
      FROM chunks
    `).get();
    
    filesIndexed = stats?.files || 0;
    totalChunks = stats?.chunks || 0;
    if (stats?.last_sync) {
      lastSync = new Date(stats.last_sync).toISOString();
    }
    db.close();
  }

  const status = {
    files_indexed: filesIndexed,
    total_chunks: totalChunks,
    last_sync: lastSync,
    sync_status: syncStatus,
    embedding_model: embeddingModel,
  };

  writeFileSync(getStatusFile(), JSON.stringify(status, null, 2));
  
  if (syncStatus === 'idle') {
    console.log(`🔍 Beacon: Indexed ${filesIndexed} files, ${totalChunks} chunks`);
  }
} catch (err) {
  console.error(`Beacon status write failed: ${err.message}`);
  process.exit(1);
}
