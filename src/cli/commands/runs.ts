import { Command } from "commander";
import {
  listRuns,
  getRun,
  getToolCallsForRun,
  getTimeline,
  type RunRow,
  type ToolCallRow,
  type LlmInputRow,
  type LlmCallRow,
} from "../../db/queries.js";

// ── formatting helpers ────────────────────────────────────────────────────────

function fmtTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

function fmtTokens(row: RunRow): string {
  if (!row.total_tokens) return "—";
  const parts = [`total: ${row.total_tokens.toLocaleString()}`];
  if (row.input_tokens) parts.push(`in: ${row.input_tokens.toLocaleString()}`);
  if (row.output_tokens) parts.push(`out: ${row.output_tokens.toLocaleString()}`);
  if (row.cache_read_tokens) parts.push(`cache: ${row.cache_read_tokens.toLocaleString()}`);
  return parts.join("  ");
}

function statusIcon(status: string): string {
  if (status === "success") return "✓";
  if (status === "error") return "✗";
  return "…";
}

function truncateStr(s: string | null | undefined, max: number): string {
  if (!s) return "(empty)";
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

function fmtJson(json: string | null | undefined, max = 120): string {
  if (!json || json === "null") return "(none)";
  try {
    const parsed = JSON.parse(json);
    const pretty = JSON.stringify(parsed, null, 2);
    return truncateStr(pretty, max);
  } catch {
    return truncateStr(json, max);
  }
}

// ── runs list ─────────────────────────────────────────────────────────────────

function runsList(options: { limit?: string }): void {
  const limit = parseInt(options.limit ?? "20", 10);
  const runs = listRuns(limit);

  if (runs.length === 0) {
    console.log("No runs found. Make sure ClawDoing plugin is enabled in OpenClaw.");
    return;
  }

  const colW = { id: 8, time: 19, dur: 8, status: 7, tokens: 28, session: 40 };

  const header = [
    "ID".padEnd(colW.id),
    "STARTED AT".padEnd(colW.time),
    "DURATION".padEnd(colW.dur),
    "STATUS".padEnd(colW.status),
    "TOKENS".padEnd(colW.tokens),
    "SESSION KEY",
  ].join("  ");

  console.log(header);
  console.log("─".repeat(header.length));

  for (const run of runs) {
    const row = [
      run.id.slice(0, colW.id).padEnd(colW.id),
      fmtTime(run.started_at).padEnd(colW.time),
      fmtDuration(run.duration_ms).padEnd(colW.dur),
      `${statusIcon(run.status)} ${run.status}`.padEnd(colW.status),
      fmtTokens(run).padEnd(colW.tokens),
      truncateStr(run.session_key, 50),
    ].join("  ");
    console.log(row);
  }

  console.log(`\n${runs.length} run(s) shown.`);
}

// ── runs inspect ─────────────────────────────────────────────────────────────

function runsInspect(runId: string, options: { tools?: boolean }): void {
  const run = getRun(runId);
  if (!run) {
    console.error(`Run not found: ${runId}`);
    process.exit(1);
  }

  // ── Header ──
  console.log();
  console.log(`Run  ${run.id}`);
  console.log(`${"─".repeat(72)}`);
  console.log(`Status    : ${statusIcon(run.status)} ${run.status}${run.error ? `  — ${run.error}` : ""}`);
  console.log(`Started   : ${fmtTime(run.started_at)}`);
  console.log(`Duration  : ${fmtDuration(run.duration_ms)}`);
  console.log(`Session   : ${run.session_key ?? "—"}`);
  if (run.workspace_dir) console.log(`Workspace : ${run.workspace_dir}`);
  if (run.trigger) console.log(`Trigger   : ${run.trigger}`);
  console.log(`Tokens    : ${fmtTokens(run)}`);
  console.log();

  if (options.tools) {
    printToolsOnly(run.id);
    return;
  }

  printTimeline(run.id);
}

function printToolsOnly(runId: string): void {
  const toolCalls = getToolCallsForRun(runId);
  if (toolCalls.length === 0) {
    console.log("No tool calls recorded for this run.");
    return;
  }

  console.log("Tool Calls:");
  console.log("─".repeat(72));

  for (const tc of toolCalls) {
    printToolCall(tc, { verbose: true });
  }

  console.log(`\n${toolCalls.length} tool call(s).`);
}

function printToolCall(tc: ToolCallRow, opts: { verbose: boolean }): void {
  const icon = tc.status === "success" ? "✓" : tc.status === "error" ? "✗" : "…";
  const dur = fmtDuration(tc.duration_ms);
  const time = fmtTime(tc.started_at);

  console.log(`  ${time}  [${icon}] Tool: ${tc.tool_name}  (${tc.tool_call_id})  ${dur}`);

  if (opts.verbose) {
    if (tc.params) {
      console.log(`    Params : ${fmtJson(tc.params, 200)}`);
    }
    if (tc.result) {
      const resultStr = fmtJson(tc.result, 300);
      const truncNote = tc.result_truncated ? " [truncated to 8KB]" : "";
      console.log(`    Result : ${resultStr}${truncNote}`);
    }
    if (tc.error) {
      console.log(`    Error  : ${tc.error}`);
    }
    console.log();
  }
}

function printLlmInput(li: LlmInputRow): void {
  const time = fmtTime(li.occurred_at);
  const model = li.model ?? li.provider ?? "unknown";
  console.log(`  ${time}  [→] LLM Request → ${model}`);
  if (li.system_prompt) {
    console.log(`    System : ${truncateStr(li.system_prompt, 150)}`);
  }
  if (li.prompt) {
    console.log(`    Prompt : ${truncateStr(li.prompt, 200)}`);
  }
  if (li.history_message_count !== null) {
    console.log(`    History: ${li.history_message_count} message(s)`);
  }
  console.log();
}

function printLlmOutput(lc: LlmCallRow): void {
  const time = fmtTime(lc.occurred_at);
  const model = lc.model ?? lc.provider ?? "unknown";
  const tokens =
    lc.total_tokens
      ? `  [${lc.input_tokens ?? 0} in / ${lc.output_tokens ?? 0} out${lc.cache_read_tokens ? ` / ${lc.cache_read_tokens} cached` : ""}]`
      : "";

  console.log(`  ${time}  [←] LLM Response ← ${model}${tokens}`);
  if (lc.last_assistant) {
    console.log(`    Reply  : ${truncateStr(lc.last_assistant, 300)}`);
  }
  console.log();
}

function printTimeline(runId: string): void {
  const entries = getTimeline(runId);

  if (entries.length === 0) {
    console.log("No events recorded for this run yet.");
    return;
  }

  console.log("Timeline:");
  console.log("─".repeat(72));
  console.log();

  for (const entry of entries) {
    if (entry.type === "llm_input") {
      printLlmInput(entry.data as LlmInputRow);
    } else if (entry.type === "tool_call") {
      printToolCall(entry.data as ToolCallRow, { verbose: true });
    } else if (entry.type === "llm_output") {
      printLlmOutput(entry.data as LlmCallRow);
    }
  }
}

// ── export ────────────────────────────────────────────────────────────────────

export function registerRunsCommands(program: Command): void {
  const runsCmd = program.command("runs").description("inspect agent runs");

  runsCmd
    .command("list")
    .description("list recent runs")
    .option("-n, --limit <n>", "number of runs to show", "20")
    .action(runsList);

  runsCmd
    .command("inspect <runId>")
    .description("show timeline for a run")
    .option("--tools", "show tool calls only")
    .action(runsInspect);
}
