import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"

// ──────────────────────────────────────────────
// Sidebar widget for the Beacon plugin.
// Shows: index status, file count, chunk count, last sync
// ──────────────────────────────────────────────

type BeaconStatus = {
  files_indexed: number
  total_chunks: number
  last_sync: string
  sync_status: "idle" | "syncing" | "error"
  embedding_model: string
}

function stableID(prefix: string, seed: string): string {
  return `${prefix}_${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`
}

function resolveStatusFile(api: TuiPluginApi): string {
  const root = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state")
  const scope = String(api.state.path.worktree ?? api.state.path.directory ?? process.cwd())
  return join(root, "beacon-opencode", stableID("scope", scope), "status.json")
}

function readStatusSync(statusFile: string): BeaconStatus | null {
  try {
    if (!existsSync(statusFile)) return null
    const raw = readFileSync(statusFile, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") {
      return parsed as BeaconStatus
    }
  } catch {
    // file missing, corrupt JSON, etc
  }
  return null
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return `${Math.floor(diffSec / 86400)}d ago`
  } catch {
    return "unknown"
  }
}

// ──────────────────────────────────────────────
// Sidebar component
// ──────────────────────────────────────────────
function BeaconSidebar(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const statusFile = resolveStatusFile(props.api)

  // tick every 5s to update "time ago" and re-read status
  const [tick, setTick] = createSignal(Math.floor(Date.now() / 1000))
  const timer = setInterval(() => setTick(Math.floor(Date.now() / 1000)), 5000)
  onCleanup(() => clearInterval(timer))

  const status = createMemo(() => {
    void tick()
    return readStatusSync(statusFile)
  })

  return (
    <Show when={status()}>
      {(s) => {
        const isSyncing = () => s().sync_status === "syncing"
        
        return (
          <box flexDirection="column" marginTop={1}>
            <text fg={theme().text}>
              <b>🔍 Beacon</b>
            </text>
            <text fg={theme().textMuted}>
              {s().files_indexed} files · {s().total_chunks} chunks
            </text>
            <text fg={
              isSyncing() ? theme().info :
              s().sync_status === "error" ? theme().error :
              theme().success
            }>
              ● {isSyncing() ? "Indexing..." : "Ready"}
            </text>
            <text fg={theme().textMuted}>
              Last sync: {formatTimeAgo(s().last_sync)}
            </text>
          </box>
        )
      }}
    </Show>
  )
}

// ──────────────────────────────────────────────
// Main TUI plugin
// ──────────────────────────────────────────────
const tui: TuiPlugin = async (api, _options, _meta) => {
  api.slots.register({
    order: 130,
    slots: {
      sidebar_content(_ctx, _props) {
        return <BeaconSidebar api={api} />
      },
    },
  })

  // Register command to show Beacon status
  if (api.command) {
    const dispose = api.command.register(() => [
      {
        title: "Beacon",
        value: "beacon.show",
        category: "Beacon",
        description: "Show Beacon index status",
        onSelect: () => {
          const statusFile = resolveStatusFile(api)
          const status = readStatusSync(statusFile)
          
          if (!status) {
            api.ui.toast({ 
              title: "Beacon", 
              message: "No index found. Run /beacon-reindex to create one.", 
              variant: "info", 
              duration: 3000 
            })
            return
          }
          
          api.ui.dialog.setSize("large")
          api.ui.dialog.replace(() => (
            <box flexDirection="column">
              <text fg={api.theme.current.primary}>
                <b>🔍 Beacon Index Status</b>
              </text>
              <text fg={api.theme.current.text}>
                Files: {status.files_indexed}
              </text>
              <text fg={api.theme.current.text}>
                Chunks: {status.total_chunks}
              </text>
              <text fg={api.theme.current.text}>
                Model: {status.embedding_model}
              </text>
              <text fg={
                status.sync_status === "syncing" ? api.theme.current.info :
                status.sync_status === "error" ? api.theme.current.error :
                api.theme.current.success
              }>
                Status: {status.sync_status}
              </text>
              <text fg={api.theme.current.textMuted}>
                Last sync: {formatTimeAgo(status.last_sync)}
              </text>
            </box>
          ))
          setTimeout(() => api.ui.dialog.clear(), 8000)
        },
      },
      {
        title: "Beacon Search",
        value: "beacon.search",
        category: "Beacon",
        description: "Semantic code search",
        onSelect: () => {
          api.ui.input.prompt({
            placeholder: "Search query...",
            onSubmit: async (query) => {
              if (!query.trim()) return
              api.ui.toast({
                title: "Beacon",
                message: `Searching for "${query}"...`,
                variant: "info",
                duration: 2000
              })
              // Use beacon_search tool via message
              await api.message.send(`@beacon_search query="${query}"`)
            }
          })
        },
      },
      {
        title: "Beacon Reindex",
        value: "beacon.reindex",
        category: "Beacon",
        description: "Force full re-index of codebase",
        onSelect: async () => {
          api.ui.toast({
            title: "Beacon",
            message: "Starting re-index...",
            variant: "info",
            duration: 3000
          })
          // Trigger reindex via message
          await api.message.send("@beacon_reindex")
        },
      },
      {
        title: "Beacon Impact",
        value: "beacon.impact",
        category: "Beacon",
        description: "Analyze change impact of a file",
        onSelect: () => {
          api.ui.input.prompt({
            placeholder: "File path to analyze...",
            onSubmit: async (file) => {
              if (!file.trim()) return
              api.ui.toast({
                title: "Beacon",
                message: `Analyzing impact of ${file}...`,
                variant: "info",
                duration: 2000
              })
              await api.message.send(`@beacon_impact file="${file}"`)
            }
          })
        },
      },
      {
        title: "Beacon Smell",
        value: "beacon.smell",
        category: "Beacon",
        description: "Detect code smells",
        onSelect: async () => {
          api.ui.toast({
            title: "Beacon",
            message: "Scanning for code smells...",
            variant: "info",
            duration: 3000
          })
          await api.message.send("@beacon_smell")
        },
      },
    ])
    api.lifecycle.onDispose(dispose)
  }
}

// Plugin module shape required by the OpenCode TUI loader
const tuiModule: TuiPluginModule = {
  id: "beacon-opencode.tui",
  tui,
}

export default tuiModule
