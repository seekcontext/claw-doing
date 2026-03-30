/**
 * Offline self-test for the M2 ingest pipeline.
 *
 * Runs against an in-memory SQLite database — no OpenClaw, no server needed.
 * Usage: npm test   (which runs: npm run build && node dist/test/ingest-test.js)
 */

import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "../db/schema.js";
import { setDb, closeDb } from "../db/db.js";
import {
  ingestBeforeAgentStart,
  ingestBeforeToolCall,
  ingestAfterToolCall,
  ingestLlmInput,
  ingestLlmOutput,
  ingestAgentEnd,
} from "../db/ingest.js";
import {
  listRuns,
  getRun,
  getToolCallsForRun,
  getLlmInputsForRun,
  getLlmCallsForRun,
  getTimeline,
} from "../db/queries.js";

// ── test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    console.log(`  ✓  ${msg}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${msg}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual === expected) {
    console.log(`  ✓  ${msg}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${msg}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual  : ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ${"─".repeat(60 - name.length)}`);
}

// ── setup in-memory DB ────────────────────────────────────────────────────────

section("Setup");

const memDb = new DatabaseSync(":memory:");
memDb.exec("PRAGMA journal_mode = WAL");
memDb.exec(SCHEMA_SQL);
setDb(memDb);
console.log("  ✓  in-memory SQLite database initialized");

// ── fixtures ──────────────────────────────────────────────────────────────────

const RUN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const SESSION_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const SESSION_KEY = "agent:main:feishu:direct:ou_test123";
const AGENT_ID = "cccccccc-0000-4000-8000-000000000003";

const baseCtx = {
  runId: RUN_ID,
  sessionId: SESSION_ID,
  sessionKey: SESSION_KEY,
  agentId: AGENT_ID,
  workspaceDir: "/home/test/project",
  trigger: "message",
  channelId: "ch_001",
};

// ── test: before_agent_start ──────────────────────────────────────────────────

section("before_agent_start");

// First fire (no messages)
ingestBeforeAgentStart({ prompt: "帮我整理一个 checklist" }, baseCtx);

let run = getRun(RUN_ID);
assert(run !== null, "run record created");
assertEqual(run?.status, "running", "status = running");
assertEqual(run?.session_key, SESSION_KEY, "session_key stored");
assertEqual(run?.agent_id, AGENT_ID, "agent_id stored");
assertEqual(run?.workspace_dir, "/home/test/project", "workspace_dir stored");

// Second fire (with messages) — should be ignored (INSERT OR IGNORE)
ingestBeforeAgentStart({ prompt: "帮我整理一个 checklist", messages: [{ role: "user" }] }, baseCtx);

const runs = listRuns(10);
assertEqual(runs.length, 1, "deduplication: only 1 run record after double-fire");

// ── test: llm_input ───────────────────────────────────────────────────────────

section("llm_input");

const SYSTEM_PROMPT = "You are a helpful assistant. You help users manage tasks.";
const USER_PROMPT = "帮我整理一个 checklist";

ingestLlmInput({
  runId: RUN_ID,
  sessionId: SESSION_ID,
  provider: "moonshot",
  model: "kimi-latest",
  systemPrompt: SYSTEM_PROMPT,
  prompt: USER_PROMPT,
  historyMessages: [
    { role: "user", content: "你好" },
    { role: "assistant", content: "你好！有什么可以帮你？" },
    { role: "user", content: USER_PROMPT },
  ],
}, {});

const llmInputs = getLlmInputsForRun(RUN_ID);
assertEqual(llmInputs.length, 1, "1 llm_input record created");
assertEqual(llmInputs[0]!.provider, "moonshot", "provider stored");
assertEqual(llmInputs[0]!.model, "kimi-latest", "model stored");
assertEqual(llmInputs[0]!.system_prompt, SYSTEM_PROMPT, "system_prompt stored");
assertEqual(llmInputs[0]!.prompt, USER_PROMPT, "prompt stored");
assertEqual(llmInputs[0]!.history_message_count, 3, "history_message_count = 3");

const preview = JSON.parse(llmInputs[0]!.history_preview ?? "[]") as unknown[];
assertEqual(preview.length, 2, "history_preview = last 2 messages");

// ── test: before_tool_call ────────────────────────────────────────────────────

section("before_tool_call");

ingestBeforeToolCall({
  runId: RUN_ID,
  toolCallId: "write:1",
  toolName: "write",
  params: { path: "checklist.md", content: "- [ ] Step 1\n- [ ] Step 2" },
}, baseCtx);

let toolCalls = getToolCallsForRun(RUN_ID);
assertEqual(toolCalls.length, 1, "1 tool_call record created");
assertEqual(toolCalls[0]!.tool_name, "write", "tool_name = write");
assertEqual(toolCalls[0]!.sequence_no, 1, "sequence_no = 1");
assertEqual(toolCalls[0]!.status, "running", "status = running before after_tool_call");
assert(toolCalls[0]!.params !== null, "params stored");

// ── test: after_tool_call ─────────────────────────────────────────────────────

section("after_tool_call");

ingestAfterToolCall({
  runId: RUN_ID,
  toolCallId: "write:1",
  toolName: "write",
  params: { path: "checklist.md", content: "- [ ] Step 1\n- [ ] Step 2" },
  result: { success: true, message: "File written" },
  durationMs: 45,
}, baseCtx);

toolCalls = getToolCallsForRun(RUN_ID);
assertEqual(toolCalls[0]!.status, "success", "status = success after after_tool_call");
assertEqual(toolCalls[0]!.duration_ms, 45, "duration_ms = 45");
assert(toolCalls[0]!.result !== null, "result stored");

// ── test: second tool call ────────────────────────────────────────────────────

section("second tool call (exec)");

ingestBeforeToolCall({
  runId: RUN_ID,
  toolCallId: "exec:2",
  toolName: "exec",
  params: { command: "cat checklist.md" },
}, baseCtx);

ingestAfterToolCall({
  runId: RUN_ID,
  toolCallId: "exec:2",
  toolName: "exec",
  params: { command: "cat checklist.md" },
  result: { output: "- [ ] Step 1\n- [ ] Step 2", exitCode: 0 },
  durationMs: 12,
}, baseCtx);

toolCalls = getToolCallsForRun(RUN_ID);
assertEqual(toolCalls.length, 2, "2 tool_calls after second tool");
assertEqual(toolCalls[1]!.tool_name, "exec", "second tool = exec");
assertEqual(toolCalls[1]!.duration_ms, 12, "exec duration_ms = 12");

// ── test: result truncation ───────────────────────────────────────────────────

section("result truncation (>8KB)");

const bigResult = "x".repeat(10_000);

ingestBeforeToolCall({
  runId: RUN_ID,
  toolCallId: "read:3",
  toolName: "read",
  params: { path: "bigfile.txt" },
}, baseCtx);

ingestAfterToolCall({
  runId: RUN_ID,
  toolCallId: "read:3",
  toolName: "read",
  params: { path: "bigfile.txt" },
  result: bigResult,
  durationMs: 5,
}, baseCtx);

toolCalls = getToolCallsForRun(RUN_ID);
const readCall = toolCalls.find((t) => t.tool_name === "read");
assert(readCall !== undefined, "read tool_call exists");
assertEqual(readCall?.result_truncated, 1, "result_truncated = 1 for 10KB result");
assert((readCall?.result?.length ?? 0) <= 8200, "result stored within 8KB limit");

// ── test: second llm_input ────────────────────────────────────────────────────

section("second llm_input (after tools)");

ingestLlmInput({
  runId: RUN_ID,
  sessionId: SESSION_ID,
  provider: "moonshot",
  model: "kimi-latest",
  systemPrompt: SYSTEM_PROMPT,
  prompt: USER_PROMPT,
  historyMessages: [
    { role: "user", content: "你好" },
    { role: "assistant", content: "你好！有什么可以帮你？" },
    { role: "user", content: USER_PROMPT },
    { role: "assistant", content: "[calls write:1]" },
    { role: "tool", content: "File written" },
  ],
}, {});

const llmInputs2 = getLlmInputsForRun(RUN_ID);
assertEqual(llmInputs2.length, 2, "2 llm_inputs after second LLM call");
assertEqual(llmInputs2[1]!.history_message_count, 5, "second llm_input has 5 history messages");

// ── test: llm_output ──────────────────────────────────────────────────────────

section("llm_output");

ingestLlmOutput({
  runId: RUN_ID,
  sessionId: SESSION_ID,
  provider: "moonshot",
  model: "kimi-latest",
  assistantTexts: ["[calls write:1]", "好的，checklist 已经创建完毕！"],
  lastAssistant: "好的，checklist 已经创建完毕！",
  usage: { input: 1200, output: 350, cacheRead: 100, total: 1650 },
}, {});

const llmCalls = getLlmCallsForRun(RUN_ID);
assertEqual(llmCalls.length, 1, "1 llm_call record");
assertEqual(llmCalls[0]!.input_tokens, 1200, "input_tokens = 1200");
assertEqual(llmCalls[0]!.output_tokens, 350, "output_tokens = 350");
assertEqual(llmCalls[0]!.total_tokens, 1650, "total_tokens = 1650");
assertEqual(llmCalls[0]!.last_assistant, "好的，checklist 已经创建完毕！", "last_assistant stored");

// tokens synced to run
run = getRun(RUN_ID);
assertEqual(run?.total_tokens, 1650, "tokens synced to runs table");
assertEqual(run?.cache_read_tokens, 100, "cache_read_tokens synced");

// ── test: agent_end ───────────────────────────────────────────────────────────

section("agent_end");

ingestAgentEnd({
  success: true,
  durationMs: 8500,
  messages: [
    { role: "user", content: "prompt" },
    { role: "assistant", content: "很长的内容..." },
  ], // should be dropped
}, baseCtx);

run = getRun(RUN_ID);
assertEqual(run?.status, "success", "status = success after agent_end");
assertEqual(run?.duration_ms, 8500, "duration_ms = 8500");
assert(run?.ended_at !== null, "ended_at set");
assert(run?.error === null, "no error on success");

// ── test: timeline ordering ───────────────────────────────────────────────────

section("timeline ordering");

const timeline = getTimeline(RUN_ID);
assert(timeline.length >= 5, `timeline has ${timeline.length} entries (≥5)`);

// All entries should have increasing occurred_at (or equal for same-ms)
let ordered = true;
for (let i = 1; i < timeline.length; i++) {
  if ((timeline[i]!.occurred_at ?? 0) < (timeline[i - 1]!.occurred_at ?? 0)) {
    ordered = false;
    break;
  }
}
assert(ordered, "timeline entries are in chronological order");

const types = timeline.map((e) => e.type);
assert(types.includes("llm_input"), "timeline includes llm_input");
assert(types.includes("tool_call"), "timeline includes tool_call");
assert(types.includes("llm_output"), "timeline includes llm_output");

// ── test: raw_events ──────────────────────────────────────────────────────────

section("raw_events completeness");

const rawCount = (memDb.prepare("SELECT COUNT(*) as c FROM raw_events").get() as { c: number }).c;
assert(rawCount >= 8, `raw_events has ${rawCount} entries (≥8, all hooks recorded)`);

const hooks = (memDb.prepare("SELECT DISTINCT hook FROM raw_events ORDER BY hook").all() as { hook: string }[]).map((r) => r.hook);
assert(hooks.includes("before_agent_start"), "raw_events has before_agent_start");
assert(hooks.includes("agent_end"), "raw_events has agent_end");
assert(hooks.includes("before_tool_call"), "raw_events has before_tool_call");
assert(hooks.includes("after_tool_call"), "raw_events has after_tool_call");
assert(hooks.includes("llm_input"), "raw_events has llm_input");
assert(hooks.includes("llm_output"), "raw_events has llm_output");

// ── test: error run ───────────────────────────────────────────────────────────

section("error run");

const ERR_RUN_ID = "aaaaaaaa-0000-4000-8000-000000000099";
const errCtx = { ...baseCtx, runId: ERR_RUN_ID };

ingestBeforeAgentStart({ prompt: "do something risky" }, errCtx);
ingestAgentEnd({ success: false, durationMs: 1200, error: "Tool exec failed: permission denied" }, errCtx);

const errRun = getRun(ERR_RUN_ID);
assertEqual(errRun?.status, "error", "error run status = error");
assertEqual(errRun?.error, "Tool exec failed: permission denied", "error message stored");

// ── summary ───────────────────────────────────────────────────────────────────

closeDb();

console.log(`\n${"═".repeat(62)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(62)}`);

if (failed > 0) {
  process.exit(1);
}
