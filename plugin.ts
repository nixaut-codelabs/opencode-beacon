import { tool } from "@opencode-ai/plugin"
import { spawn } from "bun"
import path from "path"
import os from "os"
import { readFileSync, writeFileSync, existsSync } from "fs"

const BEACON_ROOT = path.join(os.homedir(), ".config", "opencode", "beacon-scripts")



function spawnScript(script: string, args: string[] = [], opts: { cwd?: string; timeout?: number } = {}) {
  const cwd = opts.cwd || process.cwd()
  const timeout = opts.timeout || 30_000

  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const proc = spawn(["node", path.join(BEACON_ROOT, script), ...args], {
      cwd,
      env: { ...process.env, BEACON_ROOT },
      stdout: "pipe",
      stderr: "pipe",
    })

    const timer = setTimeout(() => {
      proc.kill()
      resolve({ stdout: "", stderr: "timeout", exitCode: 1 })
    }, timeout)

    Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
      .then(([stdout, stderr, exitCode]) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: exitCode ?? 1 })
      })
      .catch((err) => {
        clearTimeout(timer)
        resolve({ stdout: "", stderr: err.message, exitCode: 1 })
      })
  })
}

export const BeaconPlugin = async (ctx: any) => {
  const cwd = ctx.directory || process.cwd()
  let syncInProgress = false
  let lastSyncStatus: { files: number; chunks: number; time: string } | null = null

  return {
    // Session start → full index or diff-based catch-up
    "session.created": async () => {
      // commands injected by user in opencode.json
      await spawnScript("ensure-deps.js", [], { cwd, timeout: 180_000 })
      syncInProgress = true
      spawnScript("sync.js", [], { cwd, timeout: 300_000 })
        .then(async (result) => {
          syncInProgress = false
          // Parse sync result for status
          try {
            const statusResult = await spawnScript("status.js", [], { cwd, timeout: 5000 })
            if (statusResult.exitCode === 0) {
              const status = JSON.parse(statusResult.stdout)
              lastSyncStatus = {
                files: status.files_indexed,
                chunks: status.total_chunks,
                time: status.last_sync,
              }
            }
          } catch {}
        })
        .catch(err => {
          syncInProgress = false
          console.error(`Beacon sync failed: ${err.message}`)
        })
    },

    // File edited → re-embed that file
    "file.edited": async (input: any) => {
      const filePath = input?.filePath || input?.file
      if (!filePath) return
      spawnScript("embed-file.js", [filePath], { cwd }).catch(err => {
        console.error(`Beacon embed failed for ${filePath}: ${err.message}`)
      })
    },

    // After tool execution → GC if it was a bash command
    "tool.execute.after": async (input: any) => {
      if (input?.tool === "bash" || input?.tool === "Bash") {
        spawnScript("gc.js", [], { cwd }).catch(err => {
          console.error(`Beacon GC failed: ${err.message}`)
        })
      }
    },

    // Before compaction → inject index status
    "experimental.session.compacting": async (_input: any, output: any) => {
      const result = await spawnScript("status.js", ["--compact-warning"], { cwd, timeout: 5000 })
      if (result.stdout.trim()) {
        output.context?.push(result.stdout.trim())
      }
    },

    // TUI toast - show Beacon status info
    "tui.toast.show": async (input: any, output: any) => {
      // Show sync status when session becomes idle
      if (input?.event?.type === "session.idle" && lastSyncStatus) {
        output.toasts = output.toasts || []
        output.toasts.push({
          title: "🔍 Beacon",
          description: `Indexed ${lastSyncStatus.files} files, ${lastSyncStatus.chunks} chunks`,
          variant: "info",
          duration: 5000,
        })
      }
    },

    // Session status - show Beacon info in sidebar
    "session.status": async (input: any, output: any) => {
      if (lastSyncStatus) {
        output.items = output.items || []
        output.items.push({
          label: "🔍 Beacon",
          value: `${lastSyncStatus.files} files · ${lastSyncStatus.chunks} chunks`,
        })
      } else if (syncInProgress) {
        output.items = output.items || []
        output.items.push({
          label: "🔍 Beacon",
          value: "Indexing...",
        })
      }
    },

    // Event handler for session status
    event: async ({ event }: any) => {
      // Log sync completion
      if (event.type === "session.idle" && syncInProgress) {
        syncInProgress = false
      }
    },

    // Custom tools
    tool: {
      // ─── Core Search ───────────────────────────────────────────────
      beacon_search: tool({
        description: "Semantic code search — finds code by meaning, not just string matching. Hybrid search (vector + BM25 + identifier boosting). Use for conceptual queries like 'authentication flow' or 'database connection'.",
        args: {
          query: tool.schema.string(),
          top_k: tool.schema.optional(tool.schema.number()),
          threshold: tool.schema.optional(tool.schema.number()),
          path_filter: tool.schema.optional(tool.schema.string()),
        },
        async execute(args: any) {
          const scriptArgs = [args.query]
          if (args.top_k) scriptArgs.push("--top-k", String(args.top_k))
          if (args.threshold) scriptArgs.push("--threshold", String(args.threshold))
          if (args.path_filter) scriptArgs.push("--path", args.path_filter)
          const result = await spawnScript("search.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr || "Search failed" }) : result.stdout
        },
      }),

      beacon_index: tool({
        description: "Show Beacon index status — files indexed, chunks, coverage, embedding model, sync status.",
        args: {},
        async execute() {
          const result = await spawnScript("index-info.js", [], { cwd, timeout: 10_000 })
          return result.stdout || result.stderr || "No index info available"
        },
      }),

      beacon_status: tool({
        description: "Quick health check — file count, chunk count, last sync time, sync status.",
        args: {},
        async execute() {
          const result = await spawnScript("status.js", [], { cwd, timeout: 10_000 })
          return result.stdout || result.stderr || "No status available"
        },
      }),

      beacon_reindex: tool({
        description: "Force full re-index from scratch. Deletes existing embeddings and rebuilds.",
        args: {},
        async execute() {
          const result = await spawnScript("sync.js", ["--force"], { cwd, timeout: 300_000 })
          return result.stdout || result.stderr || "Reindex complete"
        },
      }),

      // ─── Smart Context Injection ───────────────────────────────────
      beacon_context: tool({
        description: "Smart context injection — returns the most relevant code chunks for a query, merged and token-limited. Use to auto-inject relevant code into context without manual search.",
        args: {
          query: tool.schema.string(),
          top_k: tool.schema.optional(tool.schema.number()),
          max_tokens: tool.schema.optional(tool.schema.number()),
        },
        async execute(args: any) {
          const scriptArgs = [args.query]
          if (args.top_k) scriptArgs.push("--top-k", String(args.top_k))
          if (args.max_tokens) scriptArgs.push("--max-tokens", String(args.max_tokens))
          const result = await spawnScript("context.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Query Expansion ───────────────────────────────────────────
      beacon_expand: tool({
        description: "Query expansion with Turkish support — expands a query into related terms using code synonyms and Turkish→English mappings. Use before search for better recall.",
        args: {
          query: tool.schema.string(),
          turkish: tool.schema.optional(tool.schema.boolean()),
        },
        async execute(args: any) {
          const scriptArgs = [args.query]
          if (args.turkish) scriptArgs.push("--turkish")
          const result = await spawnScript("query-expansion.js", scriptArgs, { cwd, timeout: 5_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── File Relationship Graph ───────────────────────────────────
      beacon_graph: tool({
        description: "File relationship graph — shows which files import/depend on a given file. Types: dependents (who imports me), dependencies (what do I import), impact (full radius).",
        args: {
          file: tool.schema.string(),
          type: tool.schema.optional(tool.schema.string()),
          depth: tool.schema.optional(tool.schema.number()),
        },
        async execute(args: any) {
          const scriptArgs = [args.file]
          if (args.type) scriptArgs.push("--type", args.type)
          if (args.depth) scriptArgs.push("--depth", String(args.depth))
          const result = await spawnScript("graph-search.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Pattern Search ────────────────────────────────────────────
      beacon_pattern: tool({
        description: "Pattern search — finds code matching common patterns: api-endpoint, database-query, react-component, class, function, test, config, route.",
        args: {
          pattern: tool.schema.string(),
          path_filter: tool.schema.optional(tool.schema.string()),
        },
        async execute(args: any) {
          const scriptArgs = [args.pattern]
          if (args.path_filter) scriptArgs.push("--path", args.path_filter)
          const result = await spawnScript("pattern-search.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Incremental Suggestions ───────────────────────────────────
      beacon_suggest: tool({
        description: "Incremental search suggestions — returns autocomplete suggestions for a partial query. Use for type-ahead search UX.",
        args: {
          partial: tool.schema.string(),
          limit: tool.schema.optional(tool.schema.number()),
        },
        async execute(args: any) {
          const scriptArgs = [args.partial]
          if (args.limit) scriptArgs.push("--limit", String(args.limit))
          const result = await spawnScript("suggest.js", scriptArgs, { cwd, timeout: 10_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Change Impact Analysis ────────────────────────────────────
      beacon_impact: tool({
        description: "Change impact analysis — shows what files would be affected if you modify a given file. Risk levels: low (1-2), medium (3-5), high (6+).",
        args: {
          file: tool.schema.string(),
          depth: tool.schema.optional(tool.schema.number()),
        },
        async execute(args: any) {
          const scriptArgs = [args.file]
          if (args.depth) scriptArgs.push("--depth", String(args.depth))
          const result = await spawnScript("impact.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Code Smell Detection ──────────────────────────────────────
      beacon_smell: tool({
        description: "Code smell detection — finds dead code (unused exports), duplicate code (high similarity), and complex functions (>50 lines or deep nesting).",
        args: {
          type: tool.schema.optional(tool.schema.string()),
          path_filter: tool.schema.optional(tool.schema.string()),
        },
        async execute(args: any) {
          const scriptArgs: string[] = []
          if (args.type) scriptArgs.push("--type", args.type)
          if (args.path_filter) scriptArgs.push("--path", args.path_filter)
          const result = await spawnScript("smell.js", scriptArgs, { cwd, timeout: 60_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Documentation Linking ─────────────────────────────────────
      beacon_docs: tool({
        description: "Documentation linking — finds JSDoc comments, README sections, and related markdown files for a given source file.",
        args: {
          file: tool.schema.string(),
          line: tool.schema.optional(tool.schema.number()),
        },
        async execute(args: any) {
          const scriptArgs = [args.file]
          if (args.line) scriptArgs.push("--line", String(args.line))
          const result = await spawnScript("docs.js", scriptArgs, { cwd, timeout: 15_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Temporal Search ───────────────────────────────────────────
      beacon_temporal: tool({
        description: "Temporal search — semantic search filtered by git history date range. Find code changed between specific dates.",
        args: {
          query: tool.schema.string(),
          since: tool.schema.optional(tool.schema.string()),
          until: tool.schema.optional(tool.schema.string()),
        },
        async execute(args: any) {
          const scriptArgs = [args.query]
          if (args.since) scriptArgs.push("--since", args.since)
          if (args.until) scriptArgs.push("--until", args.until)
          const result = await spawnScript("temporal.js", scriptArgs, { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Multi-repo Search ─────────────────────────────────────────
      beacon_multi: tool({
        description: "Multi-repo search — search across multiple repositories simultaneously. Returns aggregated results grouped by repo.",
        args: {
          query: tool.schema.string(),
          repos: tool.schema.string(),
        },
        async execute(args: any) {
          const scriptArgs = [args.query, "--repos", args.repos]
          const result = await spawnScript("multi-repo.js", scriptArgs, { cwd, timeout: 60_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),

      // ─── Semantic Diff ─────────────────────────────────────────────
      beacon_diff: tool({
        description: "Semantic diff — compares two files by meaning, not just syntax. Shows added, removed, and semantically modified sections.",
        args: {
          file1: tool.schema.string(),
          file2: tool.schema.string(),
        },
        async execute(args: any) {
          const result = await spawnScript("semantic-diff.js", [args.file1, args.file2], { cwd, timeout: 30_000 })
          return result.exitCode !== 0 ? JSON.stringify({ error: result.stderr }) : result.stdout
        },
      }),
    },
  }
}
