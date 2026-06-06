import { readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getRepoRoot } from './repo-root.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.BEACON_ROOT || path.resolve(__dirname, '..', '..');

// Platform-specific global config paths
function getGlobalConfigPath() {
  const platform = process.platform;
  const home = os.homedir();
  
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'opencode', 'beacon.json');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'opencode', 'beacon.json');
  } else {
    // Linux/Unix
    return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode', 'beacon.json');
  }
}

export function loadConfig() {
  // 1. Load defaults from plugin's config directory
  const defaultsPath = path.join(PLUGIN_ROOT, 'config', 'beacon.default.json');
  let defaults;
  try {
    defaults = JSON.parse(readFileSync(defaultsPath, 'utf-8'));
  } catch (err) {
    console.error(`Beacon: failed to parse config defaults (${defaultsPath}): ${err.message}`);
    process.exit(1);
  }

  // 2. Load global config (platform-specific)
  const globalConfigPath = getGlobalConfigPath();
  let globalConfig = {};
  if (existsSync(globalConfigPath)) {
    try {
      globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
    } catch (err) {
      console.error(`Beacon: failed to parse global config (${globalConfigPath}): ${err.message}`);
      // Continue with defaults
    }
  }

  // 3. Load project config (repo's .opencode/beacon.json)
  const projectConfigPath = path.join(getRepoRoot(), '.opencode', 'beacon.json');
  let projectConfig = {};
  if (existsSync(projectConfigPath)) {
    try {
      projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
    } catch (err) {
      console.error(`Beacon: failed to parse .opencode/beacon.json: ${err.message}`);
      process.exit(1);
    }
  }

  // Merge: defaults <- global <- project (project wins)
  let merged = deepMerge(defaults, globalConfig);
  merged = deepMerge(merged, projectConfig);

  // Resolve relative storage.path to repo root
  if (merged.storage?.path && !path.isAbsolute(merged.storage.path)) {
    merged.storage.path = path.join(getRepoRoot(), merged.storage.path);
  }

  validateConfig(merged);
  return merged;
}

function validateConfig(config) {
  if (!config.embedding?.dimensions || config.embedding.dimensions <= 0) {
    throw new Error('embedding.dimensions must be a positive number');
  }
  if (!config.chunking?.max_tokens || config.chunking.max_tokens <= 0) {
    throw new Error('chunking.max_tokens must be a positive number');
  }
  if (!config.embedding?.api_base) {
    throw new Error('embedding.api_base is required');
  }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Merge arrays: combine default and user arrays, deduplicate
      // This is especially important for include/exclude patterns where users want to ADD patterns
      result[key] = [...new Set([...target[key], ...source[key]])];
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
