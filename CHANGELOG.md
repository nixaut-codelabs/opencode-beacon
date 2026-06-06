# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-06

### Added
- Initial OpenCode port from Claude Code Beacon
- 15 tools for semantic search and code analysis
- **Core Search**: beacon_search, beacon_context, beacon_expand, beacon_suggest
- **Analysis**: beacon_graph, beacon_impact, beacon_pattern, beacon_smell
- **Advanced**: beacon_temporal, beacon_multi, beacon_diff, beacon_docs
- **Utility**: beacon_status, beacon_index, beacon_reindex
- Hybrid search (vector + BM25 + identifier boosting)
- Turkish + English query expansion
- File dependency graph (JS/TS/Python/Go)
- Code smell detection (dead code, duplicates, complexity)
- Temporal search with git history
- Multi-repository search
- Semantic file diff
- Documentation linking (JSDoc, README, markdown)
- GPU acceleration (ROCm) support
- Incremental indexing (only changed files)
- SQLite + sqlite-vec storage

### Security
- Fixed command injection in temporal.js (spawnSync + date validation)
- Fixed duplicate argument bug in multi-repo.js
- Added parseInt validation across all scripts
- Added file size limits to prevent memory issues
- Added word boundary regex for dead code detection

### Performance
- Pre-built graph parameter to avoid redundant scans
- Bounded directory walks with depth limits
- Chunk limits on duplicate detection queries
- Error logging for fire-and-forget operations
