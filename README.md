# Beacon for OpenCode

**Semantic code search plugin for OpenCode — find code by meaning, not just strings.**

Beacon indexes your codebase using embeddings and provides 15 powerful tools for semantic search, dependency analysis, code quality checks, and more.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![OpenCode](https://img.shields.io/badge/opencode-plugin-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-blue.svg)

## Features

### 🔍 Core Search
- **Semantic Search** — Find code by meaning, not just keyword matching
- **Hybrid Search** — Vector + BM25 + identifier boosting for best recall
- **Smart Context Injection** — Auto-inject relevant code into context
- **Query Expansion** — Expand queries with synonyms (Turkish + English)
- **Incremental Suggestions** — Autocomplete for search queries

### 📊 Analysis
- **File Relationship Graph** — Who imports whom? Dependency tracking
- **Change Impact Analysis** — What breaks if I change this file?
- **Pattern Search** — Find API endpoints, DB queries, React components, etc.
- **Code Smell Detection** — Dead code, duplicates, complex functions
- **Documentation Linking** — Connect code to JSDoc, README, related docs

### ⏰ Advanced
- **Temporal Search** — Search within git history date ranges
- **Multi-repo Search** — Search across multiple repositories
- **Semantic Diff** — Compare files by meaning, not just syntax

## Requirements

- **OpenCode** — Latest version
- **Embedding API** — One of:
  - **Ollama** (local, free) — `nomic-embed-text-v2-moe` or any Ollama embedding model
  - **OpenAI** — `text-embedding-3-small` or `text-embedding-3-large`
  - **Any OpenAI-compatible API** — Custom embedding endpoints

### Ollama Setup (Local, Free)

```bash
# Install Ollama (if not installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull embedding model (768 dimensions, ~957 MB)
ollama pull nomic-embed-text-v2-moe

# Start Ollama service
sudo systemctl start ollama
```

### OpenAI Setup

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."
```

### Custom API Setup

Any OpenAI-compatible embedding API works. Just configure in global config (see below).

## Installation

### Option 1: NPM (Recommended)

```bash
# In your OpenCode project
npm install opencode-beacon
```

Then add to `opencode.json`:

```json
{
  "plugin": ["opencode-beacon"]
}
```

### Option 2: Local Plugin

```bash
# Clone to OpenCode plugins directory
git clone https://github.com/nixaut-codelabs/opencode-beacon.git ~/.config/opencode/plugins/beacon

# Install dependencies
cd ~/.config/opencode/plugins/beacon
npm install
```

### Option 3: Manual

Copy `plugin.ts` and `scripts/` to `~/.config/opencode/plugins/beacon/`:

```bash
mkdir -p ~/.config/opencode/plugins/beacon
cp plugin.ts ~/.config/opencode/plugins/beacon/
cp -r scripts ~/.config/opencode/plugins/beacon/
cp package.json ~/.config/opencode/plugins/beacon/
cd ~/.config/opencode/plugins/beacon
npm install
```

## Usage

Once installed, Beacon automatically indexes your codebase on session start. Use the 15 tools in OpenCode:

### Search Tools

| Tool | Description | Example |
|------|-------------|---------|
| `beacon_search` | Semantic code search | `"user authentication flow"` |
| `beacon_context` | Smart context injection | `"database connection setup"` |
| `beacon_expand` | Query expansion | `"giriş sistemi"` → `["login", "auth"]` |
| `beacon_suggest` | Autocomplete suggestions | `"user ser"` → `["userService", "user-service.ts"]` |

### Analysis Tools

| Tool | Description | Example |
|------|-------------|---------|
| `beacon_graph` | File dependencies | `file: "auth.ts", type: "dependents"` |
| `beacon_impact` | Change impact analysis | `file: "types.ts"` → risk level |
| `beacon_pattern` | Pattern matching | `pattern: "api-endpoint"` |
| `beacon_smell` | Code smell detection | `type: "dead_code"` |

### Advanced Tools

| Tool | Description | Example |
|------|-------------|---------|
| `beacon_temporal` | Git history + search | `query: "auth", since: "2024-01-01"` |
| `beacon_multi` | Multi-repo search | `query: "config", repos: "repo1,repo2"` |
| `beacon_diff` | Semantic file comparison | `file1: "a.ts", file2: "b.ts"` |
| `beacon_docs` | Documentation linking | `file: "auth.ts"` → JSDoc, README |

### Utility Tools

| Tool | Description |
|------|-------------|
| `beacon_status` | Health check |
| `beacon_index` | Index status |
| `beacon_reindex` | Force re-index |

## Configuration

Beacon uses a 3-tier config system: **defaults** → **global** → **project** (project wins).

### Global Config (Recommended)

Platform-specific locations:

| Platform | Path |
|----------|------|
| **Linux** | `~/.config/opencode/beacon.json` |
| **macOS** | `~/Library/Application Support/opencode/beacon.json` |
| **Windows** | `%APPDATA%/opencode/beacon.json` |

Example global config:

```json
{
  "embedding": {
    "provider": "ollama",
    "api_base": "http://localhost:11434/v1",
    "model": "nomic-embed-text-v2-moe",
    "api_key_env": "",
    "dimensions": 768
  },
  "search": {
    "top_k": 10,
    "similarity_threshold": 0.25
  },
  "storage": {
    "path": ".opencode/.beacon"
  }
}
```

### Project Config

Create `.opencode/beacon.json` in your project root to override global settings:

```json
{
  "embedding": {
    "model": "text-embedding-3-small",
    "dimensions": 1536
  }
}
```

### Embedding Providers

#### Ollama (Local, Free)

```json
{
  "embedding": {
    "provider": "ollama",
    "api_base": "http://localhost:11434/v1",
    "model": "nomic-embed-text-v2-moe",
    "api_key_env": "",
    "dimensions": 768
  }
}
```

#### OpenAI

```json
{
  "embedding": {
    "provider": "openai",
    "api_base": "https://api.openai.com/v1",
    "model": "text-embedding-3-small",
    "api_key_env": "OPENAI_API_KEY",
    "dimensions": 1536
  }
}
```

Set your API key: `export OPENAI_API_KEY="sk-..."`

#### Custom OpenAI-Compatible API

Any API that implements `/v1/embeddings` endpoint:

```json
{
  "embedding": {
    "provider": "custom",
    "api_base": "https://your-api.com/v1",
    "model": "your-embedding-model",
    "api_key_env": "YOUR_API_KEY_ENV_VAR",
    "dimensions": 1024
  }
}
```

### Slash Commands

Beacon adds these slash commands to OpenCode:

| Command | Description |
|---------|-------------|
| `/beacon-search <query>` | Semantic code search |
| `/beacon-status` | Show index status |
| `/beacon-reindex` | Force full re-index |
| `/beacon-impact <file>` | Analyze change impact |
| `/beacon-smell` | Detect code smells |

### Notifications

Beacon shows toast notifications when:
- Index is ready after session start
- Re-index completes
- Errors occur during sync

## How It Works

1. **Indexing** — On session start, Beacon walks your codebase, chunks files, and generates embeddings via configured API
2. **Storage** — Embeddings stored in SQLite with `sqlite-vec` for fast vector search
3. **Hybrid Search** — Combines vector similarity, BM25 keyword matching, and identifier boosting
4. **Incremental Updates** — Only re-indexes changed files (tracked via git hash)
5. **Auto-sync** — Background sync on session start, incremental updates on file edits

### Architecture

```
plugin.ts          → OpenCode plugin wrapper (15 tools)
scripts/
├── lib/
│   ├── db.js          → SQLite + sqlite-vec operations
│   ├── embedder.js    → OpenAI-compatible embedding API
│   ├── chunker.js     → Code chunking strategy
│   ├── graph.js       → Dependency graph builder
│   ├── patterns.js    → Code pattern definitions
│   ├── synonyms.js    → Query expansion (TR + EN)
│   └── ...
├── search.js          → Core semantic search
├── context.js         → Smart context injection
├── sync.js            → Full/diff-based indexing
└── ...
```

## Performance

| Metric | Value |
|--------|-------|
| Index speed | ~100 files/sec (GPU), ~20 files/sec (CPU) |
| Search latency | <200ms (GPU), <500ms (CPU) |
| Memory usage | ~50MB base, +1MB per 1000 chunks |
| Disk usage | ~1MB per 1000 chunks |

**GPU Acceleration:** If you have an AMD GPU with ROCm, Beacon automatically uses it for 5-10x faster embedding.

## Examples

### Find authentication code

```
User: "Where is the authentication logic?"
→ beacon_search(query="authentication logic")
→ Returns: auth.ts, middleware/auth-guard.ts, routes/login.ts
```

### What breaks if I change types.ts?

```
User: "What files depend on types.ts?"
→ beacon_impact(file="types.ts")
→ Returns: 5 direct dependents, 12 transitive, risk: medium
```

### Find all API endpoints

```
User: "Show me all API endpoints"
→ beacon_pattern(pattern="api-endpoint")
→ Returns: 23 endpoints across 8 files
```

### Search recent changes

```
User: "What auth code changed this week?"
→ beacon_temporal(query="auth", since="2025-01-01")
→ Returns: 4 files changed in date range
```

## Troubleshooting

### "No index found"

Run `beacon_reindex` or restart OpenCode session.

### "Ollama connection failed"

Ensure Ollama is running:
```bash
systemctl status ollama
sudo systemctl start ollama
```

### Slow search

- Use GPU (ROCm) for 5-10x speedup
- Reduce `search.top_k` in config
- Increase `search.similarity_threshold` to filter more aggressively

### Dimension mismatch

If you changed embedding models, run `beacon_reindex` to rebuild the index.

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Test your changes
4. Submit a PR

## Credits

- **Original Beacon** — [sagarmk/beacon-plugin](https://github.com/sagarmk/beacon-plugin) for Claude Code
- **OpenCode Port** — Community effort
- **Ollama** — Local embedding inference
- **sqlite-vec** — Vector search in SQLite

## License

MIT © 2026 OpenCode Community

Original Beacon: MIT © 2026 Sagar MK
