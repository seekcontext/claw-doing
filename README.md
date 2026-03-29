# claw-doing

> See what your agent is doing — right now.

**claw-doing** is an [OpenClaw](https://openclaws.io) plugin that gives long-running agent tasks real-time progress visibility. Instead of waiting silently for minutes while your agent works, you get a live step-by-step progress feed — right in your messaging channel.

---

## The problem

When you ask OpenClaw to do something complex — research a topic, process files, build a multi-step pipeline — the interaction goes silent:

```
You:   "Research AI agent frameworks and write a report"
Agent: [silent for 8 minutes]
You:   "...is it still running?"
Agent: [finally replies, or times out]
```

You have no idea what's happening, whether it's stuck, or when it will finish.

## What claw-doing does

With claw-doing installed, the same interaction looks like this:

```
You:   "Research AI agent frameworks and write a report"

Agent: Research AI agent frameworks
       Task ID: `a3f8c2d1-...`

       Plan — 4 steps:
         1. Search and collect sources (~3 min)
         2. Extract key findings (~2 min)
         3. Cross-reference and validate (~2 min)
         4. Write and deliver report (~3 min)

       [░░░░░░░░░░] 0/4
       Starting now...

       ──── (3 minutes later) ────

       [███░░░░░░░] 1/4 — elapsed: 3m 12s

       ✓ Step 1: Found 47 sources, filtered to 14 high-quality references
       ⚠ Note: Two sources were paywalled — used abstracts only

       Next: Step 2 — Extract key findings

       ──── (2 minutes later) ────

       [██████░░░░] 2/4 — elapsed: 5m 8s

       ✓ Step 2: Extracted 31 key data points across 8 frameworks

       ... and so on ...

       [██████████] 4/4 — 11m 42s total

       ✅ Completed successfully

       Compiled a 2,800-word report covering 8 frameworks with 12 citations.
       Key finding: LangGraph leads on multi-agent orchestration; OpenClaw leads on channel integrations.

       Deliverables:
         • memory/2026-03-29-ai-agent-frameworks.md
```

---

## Installation

```bash
openclaw plugins install claw-doing
```

OpenClaw checks ClawHub first, then falls back to npm automatically.

After installation, restart your OpenClaw gateway to load the plugin.

### Enable the bootstrap instructions (recommended)

The plugin ships with `bootstrap/TASK_TRACKER.md` — a set of instructions that teaches your agent when and how to use the tracking tools. Add it to your OpenClaw workspace bootstrap:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "bootstrap-extra-files": {
          "enabled": true,
          "paths": ["node_modules/claw-doing/bootstrap/TASK_TRACKER.md"]
        }
      }
    }
  }
}
```

Or copy it manually to your workspace — locate `TASK_TRACKER.md` inside the installed package under `node_modules/claw-doing/bootstrap/` and place it in your OpenClaw workspace directory (typically `~/.openclaw/workspace/`).

Then add `TASK_TRACKER.md` to your bootstrap file list so the agent loads it on start.

---

## How it works

claw-doing registers three agent tools. The agent calls them as it works — no separate dashboard or server required.

### Tools

#### `task_plan`

Called at the **start** of a multi-step task. Registers the plan and returns a task ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | `string` | Short title for the task |
| `steps` | `Step[]` | Ordered list of steps |
| `steps[].index` | `number` | Step number (1-based) |
| `steps[].description` | `string` | What this step does |
| `steps[].estimatedMinutes` | `number?` | Optional time estimate |

Returns: task ID + formatted plan for the user.

#### `task_step_done`

Called after **each step** completes. Updates progress and notifies the user.

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | `string` | Task ID from `task_plan` |
| `stepIndex` | `number` | Which step was just completed |
| `summary` | `string` | What was accomplished |
| `deviation` | `string?` | Unexpected findings (optional) |

Returns: progress bar + step summary.

#### `task_complete`

Called when the **entire task** finishes (or fails). Delivers the final report.

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | `string` | Task ID from `task_plan` |
| `outcome` | `"success" \| "partial" \| "failed"` | Task outcome |
| `summary` | `string` | User-facing completion summary |
| `artifacts` | `string[]?` | Output files or results produced |

Returns: final progress bar + summary + deliverables list.

### Task state

Each task is persisted as a JSON file at:

```
~/.openclaw/workspace/claw-doing/tasks/<taskId>.json
```

This means task state survives agent restarts and can be inspected or archived.

---

## Configuration

Optional config in your `openclaw.config.json`:

```json
{
  "plugins": {
    "claw-doing": {
      "storageDir": "/custom/path/to/tasks",
      "progressBarWidth": 12
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `storageDir` | `~/.openclaw/workspace/claw-doing/tasks/` | Where task JSON files are stored |
| `progressBarWidth` | `10` | Width of the `█░` progress bar |

You can also set the storage directory via environment variable:

```bash
CLAW_DOING_STORAGE_DIR=/my/custom/path openclaw start
```

---

## Design principles

**Zero deployment.** Unlike dashboard-based solutions, claw-doing requires no external server, database, or Docker container. Install the plugin and it works.

**In-channel delivery.** Progress updates arrive in the same messaging channel you're already using — Discord, Telegram, WhatsApp, web chat. You don't need to open a separate UI.

**Agent-driven, not hook-driven.** The agent explicitly calls `task_step_done` after each step. This makes progress reporting intentional and semantically rich (the agent decides what counts as "done" and what to say about it), rather than relying on low-level hook instrumentation that may fire at the wrong granularity.

**Persistent state.** Task records are written to disk as JSON. They can be read, archived, or used by other tooling (dashboards, scripts) independently.

---

## Comparison with similar projects

| | claw-doing | ClawBeacon |
|---|---|---|
| **Form factor** | OpenClaw plugin (zero deployment) | Separate web app (Docker/Railway) |
| **Where you see progress** | Your chat channel | A Kanban dashboard in a browser |
| **Setup** | `openclaw plugins install claw-doing` | Clone, deploy backend + frontend |
| **Best for** | Individual users, any task | Teams managing multiple agents |

---

## Development

```bash
git clone https://github.com/seekcontext/claw-doing
cd claw-doing
npm install
npm run dev        # watch mode
npm run typecheck  # type check without emitting
npm run build      # compile to dist/
```

### Project structure

```
claw-doing/
├── index.ts                      # Plugin entry — registers all tools
├── src/
│   ├── types.ts                  # Shared Task and TaskStep interfaces
│   ├── store/
│   │   └── task-store.ts         # File-based task state (create, update, complete)
│   ├── tools/
│   │   ├── task-plan.ts          # task_plan tool handler
│   │   ├── task-step-done.ts     # task_step_done tool handler
│   │   └── task-complete.ts      # task_complete tool handler
│   └── utils/
│       └── format.ts             # Progress bar, elapsed time, outcome labels
├── bootstrap/
│   └── TASK_TRACKER.md           # Agent behavior instructions
├── openclaw.plugin.json          # Plugin manifest
└── openclaw.d.ts                 # Type stubs for openclaw peer dependency
```

---

## Roadmap

- [ ] `before_tool_call` hook to auto-detect `sessions_spawn` and link sub-agents to parent tasks
- [ ] Deviation detection: flag steps where output diverges significantly from expected
- [ ] `task_stuck` tool: pause execution and ask the user for guidance mid-task
- [ ] Task history CLI: `openclaw doing list` to review past task records
- [ ] Integration with `OpenClawTaskStatusV1` (openclaw/openclaw#42385) when merged

---

## Contributing

Pull requests welcome. Please open an issue first for significant changes. Repository: [github.com/seekcontext/claw-doing](https://github.com/seekcontext/claw-doing)

## License

MIT
