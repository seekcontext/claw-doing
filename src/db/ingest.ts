import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const RESULT_MAX_BYTES = 8192;

// ── helpers ──────────────────────────────────────────────────────────────────

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "null";
  } catch {
    return "null";
  }
}

function truncate(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) return { text, truncated: false };
  return { text: buf.slice(0, maxBytes).toString("utf8"), truncated: true };
}

function parseToolCallId(toolCallId: string): { toolName: string; sequenceNo: number | null } {
  // Format: "write:9" → toolName="write", sequenceNo=9
  const lastColon = toolCallId.lastIndexOf(":");
  if (lastColon === -1) return { toolName: toolCallId, sequenceNo: null };
  const toolName = toolCallId.slice(0, lastColon);
  const seq = parseInt(toolCallId.slice(lastColon + 1), 10);
  return { toolName, sequenceNo: isNaN(seq) ? null : seq };
}

// ── raw_event writer (used by every handler) ─────────────────────────────────

function writeRawEvent(
  hook: string,
  event: unknown,
  ctx: unknown,
  overrides?: { runId?: string | null; sessionId?: string | null; sessionKey?: string | null }
): void {
  const db = getDb();
  const e = event as Record<string, unknown>;
  const c = ctx as Record<string, unknown>;

  const runId = overrides?.runId ?? (c?.["runId"] as string | undefined) ?? (e?.["runId"] as string | undefined) ?? null;
  const sessionId = overrides?.sessionId ?? (c?.["sessionId"] as string | undefined) ?? (e?.["sessionId"] as string | undefined) ?? null;
  const sessionKey = overrides?.sessionKey ?? (c?.["sessionKey"] as string | undefined) ?? null;

  db.prepare(`
    INSERT OR IGNORE INTO raw_events (id, hook, run_id, session_id, session_key, occurred_at, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    hook,
    runId,
    sessionId,
    sessionKey,
    Date.now(),
    safeJson({ hook, ts: Date.now(), event, ctx })
  );
}

// ── hook handlers ─────────────────────────────────────────────────────────────

export function ingestBeforeAgentStart(event: unknown, ctx: unknown): void {
  try {
    const c = ctx as Record<string, unknown>;
    const runId = c["runId"] as string;
    if (!runId) return;

    writeRawEvent("before_agent_start", event, ctx);

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO runs
        (id, session_id, session_key, agent_id, workspace_dir, trigger, channel_id, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
    `).run(
      runId,
      (c["sessionId"] as string | undefined) ?? null,
      (c["sessionKey"] as string | undefined) ?? null,
      (c["agentId"] as string | undefined) ?? null,
      (c["workspaceDir"] as string | undefined) ?? null,
      (c["trigger"] as string | undefined) ?? null,
      (c["channelId"] as string | undefined) ?? null,
      Date.now()
    );
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestAgentEnd(event: unknown, ctx: unknown): void {
  try {
    const e = event as Record<string, unknown>;
    const c = ctx as Record<string, unknown>;
    const runId = (c["runId"] as string | undefined) ?? (e["runId"] as string | undefined);
    if (!runId) return;

    writeRawEvent("agent_end", event, ctx);

    const success = e["success"] as boolean | undefined;
    const durationMs = e["durationMs"] as number | undefined;

    // Drop e.messages — full conversation history, potentially megabytes
    const { messages: _dropped, ...safeEvent } = e;
    void _dropped;
    void safeEvent;

    const db = getDb();
    db.prepare(`
      UPDATE runs
      SET status = ?, ended_at = ?, duration_ms = ?, error = ?
      WHERE id = ?
    `).run(
      success === false ? "error" : "success",
      Date.now(),
      durationMs ?? null,
      success === false ? (e["error"] as string | undefined) ?? "unknown error" : null,
      runId
    );
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestBeforeToolCall(event: unknown, ctx: unknown): void {
  try {
    const e = event as Record<string, unknown>;
    const c = ctx as Record<string, unknown>;
    const runId = (e["runId"] as string | undefined) ?? (c["runId"] as string | undefined);
    const toolCallId = e["toolCallId"] as string | undefined;
    if (!runId || !toolCallId) return;

    writeRawEvent("before_tool_call", event, ctx);

    const { toolName, sequenceNo } = parseToolCallId(toolCallId);
    const sessionId = (c["sessionId"] as string | undefined) ?? null;
    const params = safeJson(e["params"]);

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO tool_calls
        (id, run_id, session_id, tool_call_id, tool_name, sequence_no, status, started_at, params)
      VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)
    `).run(
      `${runId}:${toolCallId}`,
      runId,
      sessionId,
      toolCallId,
      toolName,
      sequenceNo,
      Date.now(),
      params
    );
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestAfterToolCall(event: unknown, ctx: unknown): void {
  try {
    const e = event as Record<string, unknown>;
    const c = ctx as Record<string, unknown>;
    const runId = (e["runId"] as string | undefined) ?? (c["runId"] as string | undefined);
    const toolCallId = e["toolCallId"] as string | undefined;
    if (!runId || !toolCallId) return;

    writeRawEvent("after_tool_call", event, ctx);

    const durationMs = e["durationMs"] as number | undefined;
    const rawResult = safeJson(e["result"]);
    const { text: result, truncated } = truncate(rawResult, RESULT_MAX_BYTES);

    const db = getDb();
    db.prepare(`
      UPDATE tool_calls
      SET status = 'success', ended_at = ?, duration_ms = ?, result = ?, result_truncated = ?
      WHERE id = ?
    `).run(
      Date.now(),
      durationMs ?? null,
      result,
      truncated ? 1 : 0,
      `${runId}:${toolCallId}`
    );
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestLlmInput(event: unknown, ctx: unknown): void {
  try {
    const e = event as Record<string, unknown>;
    const runId = e["runId"] as string | undefined;
    if (!runId) return;

    writeRawEvent("llm_input", event, ctx);

    const historyMessages = e["historyMessages"];
    const history = Array.isArray(historyMessages) ? historyMessages : [];
    const historyCount = history.length;

    // Keep last 2 messages as preview
    const preview = history.slice(-2);

    const db = getDb();
    db.prepare(`
      INSERT INTO llm_inputs
        (id, run_id, session_id, provider, model, occurred_at,
         system_prompt, prompt, history_message_count, history_preview)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      runId,
      (e["sessionId"] as string | undefined) ?? null,
      (e["provider"] as string | undefined) ?? null,
      (e["model"] as string | undefined) ?? null,
      Date.now(),
      (e["systemPrompt"] as string | undefined) ?? null,
      (e["prompt"] as string | undefined) ?? null,
      historyCount,
      safeJson(preview)
    );
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestLlmOutput(event: unknown, ctx: unknown): void {
  try {
    const e = event as Record<string, unknown>;
    const runId = e["runId"] as string | undefined;
    if (!runId) return;

    writeRawEvent("llm_output", event, ctx);

    const usage = e["usage"] as Record<string, number> | undefined;
    const inputTokens = usage?.["input"] ?? null;
    const outputTokens = usage?.["output"] ?? null;
    const cacheReadTokens = usage?.["cacheRead"] ?? null;
    const totalTokens = usage?.["total"] ?? null;
    const lastAssistant = (e["lastAssistant"] as string | undefined) ?? null;

    const db = getDb();

    db.prepare(`
      INSERT INTO llm_calls
        (id, run_id, session_id, provider, model, occurred_at,
         last_assistant, input_tokens, output_tokens, cache_read_tokens, total_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      runId,
      (e["sessionId"] as string | undefined) ?? null,
      (e["provider"] as string | undefined) ?? null,
      (e["model"] as string | undefined) ?? null,
      Date.now(),
      lastAssistant,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      totalTokens
    );

    // Sync token summary onto the run record
    db.prepare(`
      UPDATE runs
      SET input_tokens = ?, output_tokens = ?, cache_read_tokens = ?, total_tokens = ?
      WHERE id = ?
    `).run(inputTokens, outputTokens, cacheReadTokens, totalTokens, runId);
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}

export function ingestRawOnly(hook: string, event: unknown, ctx: unknown): void {
  try {
    writeRawEvent(hook, event, ctx);
  } catch {
    // Never let ClawDoing crash OpenClaw
  }
}
