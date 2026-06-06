import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import path from 'path';

const EXT_MAP = {
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'js',
  '.ts': 'js', '.mts': 'js', '.cts': 'js', '.tsx': 'js',
  '.py': 'python', '.go': 'go',
};

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  'vendor', '__pycache__', '.venv', 'venv',
]);

const JS_IMPORT_RE = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
const PY_IMPORT_RE = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;
const GO_IMPORT_RE = /import\s*\(\s*([\s\S]*?)\s*\)|import\s+"([^"]+)"/g;
const GO_SINGLE_RE = /"([^"]+)"/g;

function walkFiles(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkFiles(full, results);
    } else if (stat.isFile() && EXT_MAP[path.extname(full)]) {
      results.push(full);
    }
  }
  return results;
}

function extractJSImports(content) {
  const imports = [];
  JS_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = JS_IMPORT_RE.exec(content)) !== null) {
    imports.push(match[1] || match[2] || match[3]);
  }
  return imports;
}

function extractPythonImports(content) {
  const imports = [];
  PY_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = PY_IMPORT_RE.exec(content)) !== null) {
    imports.push(match[1] || match[2]);
  }
  return imports;
}

function extractGoImports(content) {
  const imports = [];
  GO_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = GO_IMPORT_RE.exec(content)) !== null) {
    if (match[1]) {
      GO_SINGLE_RE.lastIndex = 0;
      let inner;
      while ((inner = GO_SINGLE_RE.exec(match[1])) !== null) {
        imports.push(inner[1]);
      }
    } else if (match[2]) {
      imports.push(match[2]);
    }
  }
  return imports;
}

function resolveImport(importPath, fromFile, cwd) {
  if (!importPath || importPath.startsWith('http') || importPath.startsWith('//')) return null;

  const ext = path.extname(fromFile);
  const lang = EXT_MAP[ext];

  if (lang === 'js') {
    if (importPath.startsWith('.')) {
      const base = path.resolve(path.dirname(fromFile), importPath);
      const candidates = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts',
        '/index.js', '/index.ts', '/index.jsx', '/index.tsx'];
      for (const suffix of candidates) {
        const resolved = base + suffix;
        if (existsSync(resolved)) return path.relative(cwd, resolved);
      }
      return path.relative(cwd, base);
    }
    return null;
  }

  if (lang === 'python') {
    const parts = importPath.split('.');
    const candidates = [
      path.join(...parts) + '.py',
      path.join(...parts, '__init__.py'),
    ];
    for (const c of candidates) {
      if (existsSync(path.join(cwd, c))) return c;
    }
    return importPath;
  }

  if (lang === 'go') {
    return importPath;
  }

  return null;
}

export function buildDependencyGraph(cwd) {
  const files = walkFiles(cwd);
  const graph = new Map();

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const ext = path.extname(file);
    const lang = EXT_MAP[ext];
    let rawImports;

    if (lang === 'js') rawImports = extractJSImports(content);
    else if (lang === 'python') rawImports = extractPythonImports(content);
    else if (lang === 'go') rawImports = extractGoImports(content);
    else rawImports = [];

    const resolved = new Set();
    for (const imp of rawImports) {
      const r = resolveImport(imp, file, cwd);
      if (r) resolved.add(r);
    }

    graph.set(path.relative(cwd, file), resolved);
  }

  return graph;
}

export function getDependents(filePath, cwd, prebuiltGraph = null) {
  const graph = prebuiltGraph || buildDependencyGraph(cwd);
  const target = filePath.startsWith('/') ? path.relative(cwd, filePath) : filePath;
  const dependents = [];

  for (const [file, deps] of graph) {
    if (deps.has(target)) dependents.push(file);
  }

  return dependents.sort();
}

export function getDependencies(filePath, cwd, prebuiltGraph = null) {
  const graph = prebuiltGraph || buildDependencyGraph(cwd);
  const target = filePath.startsWith('/') ? path.relative(cwd, filePath) : filePath;
  const deps = graph.get(target);
  return deps ? [...deps].sort() : [];
}

export function getImpactRadius(filePath, cwd, depth = 2, prebuiltGraph = null) {
  const graph = prebuiltGraph || buildDependencyGraph(cwd);
  const target = filePath.startsWith('/') ? path.relative(cwd, filePath) : filePath;

  const visited = new Set();
  const queue = [{ file: target, level: 0 }];
  const result = [];

  while (queue.length > 0) {
    const { file, level } = queue.shift();
    if (visited.has(file) || level > depth) continue;
    visited.add(file);

    if (file !== target) {
      result.push({ file, depth: level });
    }

    if (level < depth) {
      for (const [candidate, deps] of graph) {
        if (deps.has(file) && !visited.has(candidate)) {
          queue.push({ file: candidate, level: level + 1 });
        }
      }
    }
  }

  return result.sort((a, b) => a.depth - b.depth || a.file.localeCompare(b.file));
}
