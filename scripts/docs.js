#!/usr/bin/env node
// Called by: documentation linking queries
// Input: "file-path" [--line N]
// Output: JSON with related documentation (JSDoc, README sections, related .md files)

import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
let filePath = null;
let line = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--line' && args[i + 1]) {
    line = parseInt(args[++i], 10);
  } else if (!filePath) {
    filePath = args[i];
  }
}

if (!filePath) {
  console.error('Usage: docs.js "file-path" [--line N]');
  process.exit(1);
}

const cwd = process.cwd();
const absPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

if (!existsSync(absPath)) {
  console.log(JSON.stringify({ file: filePath, docs: [], error: 'File not found' }));
  process.exit(0);
}

const content = readFileSync(absPath, 'utf-8');
const lines = content.split('\n');
const docs = [];

function extractJSDoc() {
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
  let match;
  while ((match = jsdocRegex.exec(content)) !== null) {
    const blockEnd = content.slice(0, match.index).split('\n').length;
    const blockStart = blockEnd - match[0].split('\n').length + 1;
    if (line !== null) {
      if (blockEnd >= line && blockStart <= line + 5) {
        docs.push({ type: 'jsdoc', content: match[0].trim(), startLine: blockStart, endLine: blockEnd });
      }
    } else {
      docs.push({ type: 'jsdoc', content: match[0].trim(), startLine: blockStart, endLine: blockEnd });
    }
  }
}

function extractInlineComments() {
  const ext = path.extname(filePath);
  const commentPatterns = {
    '.ts': /^(\s*\/\/\s*.+)/gm,
    '.tsx': /^(\s*\/\/\s*.+)/gm,
    '.js': /^(\s*\/\/\s*.+)/gm,
    '.jsx': /^(\s*\/\/\s*.+)/gm,
    '.py': /^(\s*#\s*.+)/gm,
    '.rb': /^(\s*#\s*.+)/gm,
    '.go': /^(\s*\/\/\s*.+)/gm,
    '.rs': /^(\s*\/\/\/?\s*.+)/gm,
  };
  const pattern = commentPatterns[ext];
  if (!pattern) return;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (line !== null && Math.abs(lineNum - line) > 3) continue;
    const text = match[1].trim();
    if (text.length > 10 && text.length < 500) {
      docs.push({ type: 'comment', content: text, line: lineNum });
    }
  }
}

function findReadmeSection() {
  const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README.rst', 'README.txt'];
  for (const name of readmeNames) {
    const readmePath = path.join(cwd, name);
    if (!existsSync(readmePath)) continue;
    const readmeContent = readFileSync(readmePath, 'utf-8');
    const baseName = path.basename(filePath, path.extname(filePath))
      .replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

    const sectionRegex = /^#{1,3}\s+(.+)$/gm;
    let sectionMatch;
    const sections = [];
    while ((sectionMatch = sectionRegex.exec(readmeContent)) !== null) {
      sections.push({ heading: sectionMatch[1].trim(), offset: sectionMatch.index });
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextOffset = i + 1 < sections.length ? sections[i + 1].offset : readmeContent.length;
      const sectionText = readmeContent.slice(section.offset, nextOffset);
      const matchScore = computeRelevance(baseName, section.heading + ' ' + sectionText.slice(0, 200));
      if (matchScore > 0) {
        docs.push({
          type: 'readme',
          section: section.heading,
          content: sectionText.trim().slice(0, 1000),
          file: name,
          relevance: matchScore,
        });
      }
    }
    break;
  }
}

function findRelatedMarkdown() {
  const mdFiles = [];
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache']);
  const MAX_FILES = 50;
  const MAX_DEPTH = 4;

  function walkDir(dir, depth = 0) {
    if (depth > MAX_DEPTH || mdFiles.length >= MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (mdFiles.length >= MAX_FILES) break;
      const name = entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(name) && !name.startsWith('.')) {
          walkDir(path.join(dir, name), depth + 1);
        }
      } else if (entry.isFile() && name.endsWith('.md') && name.toLowerCase() !== 'readme.md') {
        mdFiles.push(path.relative(cwd, path.join(dir, name)));
      }
    }
  }

  try { walkDir(cwd); } catch { /* skip */ }

  const baseName = path.basename(filePath, path.extname(filePath))
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .toLowerCase();

  for (const mdFile of mdFiles) {
    const mdBase = path.basename(mdFile, '.md').toLowerCase();
    if (mdBase.includes(baseName) || baseName.includes(mdBase)) {
      try {
        const mdContent = readFileSync(path.join(cwd, mdFile), 'utf-8');
        docs.push({
          type: 'related_md',
          file: mdFile,
          content: mdContent.trim().slice(0, 1000),
        });
      } catch { /* skip unreadable */ }
    }
  }
}

function computeRelevance(name, text) {
  const lower = text.toLowerCase();
  const nameLower = name.toLowerCase();
  if (lower.includes(nameLower)) return 2;
  const words = nameLower.split(/(?=[A-Z])|[-_\s]/).filter(w => w.length > 2);
  let hits = 0;
  for (const w of words) {
    if (lower.includes(w)) hits++;
  }
  return words.length > 0 ? hits / words.length : 0;
}

try {
  extractJSDoc();
  extractInlineComments();
  findReadmeSection();
  findRelatedMarkdown();

  if (line !== null) {
    const contextStart = Math.max(0, line - 3);
    const contextEnd = Math.min(lines.length, line + 2);
    const context = lines.slice(contextStart, contextEnd).join('\n');
    console.log(JSON.stringify({
      file: filePath,
      line,
      context,
      docs: docs.slice(0, 20),
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      file: filePath,
      docs: docs.slice(0, 30),
    }, null, 2));
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
