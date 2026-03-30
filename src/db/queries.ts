import { getDb } from "./db.js";

export interface RunRow {
  id: string;
  session_id: string | null;
  session_key: string | null;
  agent_id: string | null;
  workspace_dir: string | null;
  trigger: string | null;
  channel_id: string | null;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  total_tokens: number | null;
}

export interface ToolCallRow {
  id: string;
  run_id: string;
  session_id: string | null;
  tool_call_id: string;
  tool_name: string;
  sequence_no: number | null;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
  params: string | null;
  result: string | null;
  result_truncated: number;
  error: string | null;
}

export interface LlmInputRow {
  id: string;
  run_id: string;
  session_id: string | null;
  provider: string | null;
  model: string | null;
  occurred_at: number | null;
  system_prompt: string | null;
  prompt: string | null;
  history_message_count: number | null;
  history_preview: string | null;
}

export interface LlmCallRow {
  id: string;
  run_id: string;
  session_id: string | null;
  provider: string | null;
  model: string | null;
  occurred_at: number | null;
  last_assistant: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  total_tokens: number | null;
}

export function listRuns(limit = 20): RunRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM runs
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as unknown as RunRow[];
}

export function getRun(runId: string): RunRow | null {
  const db = getDb();
  // Support short prefix IDs (like git short hashes) as well as full UUIDs.
  if (runId.length === 36) {
    return (db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) ?? null) as unknown as RunRow | null;
  }
  const rows = db.prepare(`SELECT * FROM runs WHERE id LIKE ?`).all(runId + "%") as unknown as RunRow[];
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(`Ambiguous run ID prefix "${runId}" matches ${rows.length} runs. Use a longer prefix.`);
  }
  return rows[0];
}

export function getToolCallsForRun(runId: string): ToolCallRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM tool_calls
    WHERE run_id = ?
    ORDER BY started_at ASC, sequence_no ASC
  `).all(runId) as unknown as ToolCallRow[];
}

export function getLlmInputsForRun(runId: string): LlmInputRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM llm_inputs
    WHERE run_id = ?
    ORDER BY occurred_at ASC
  `).all(runId) as unknown as LlmInputRow[];
}

export function getLlmCallsForRun(runId: string): LlmCallRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM llm_calls
    WHERE run_id = ?
    ORDER BY occurred_at ASC
  `).all(runId) as unknown as LlmCallRow[];
}

export interface TimelineEntry {
  type: "llm_input" | "tool_call" | "llm_output";
  occurred_at: number;
  data: LlmInputRow | ToolCallRow | LlmCallRow;
}

export function getTimeline(runId: string): TimelineEntry[] {
  const toolCalls = getToolCallsForRun(runId);
  const llmInputs = getLlmInputsForRun(runId);
  const llmCalls = getLlmCallsForRun(runId);

  const entries: TimelineEntry[] = [];

  for (const tc of toolCalls) {
    entries.push({ type: "tool_call", occurred_at: tc.started_at ?? 0, data: tc });
  }
  for (const li of llmInputs) {
    entries.push({ type: "llm_input", occurred_at: li.occurred_at ?? 0, data: li });
  }
  for (const lc of llmCalls) {
    entries.push({ type: "llm_output", occurred_at: lc.occurred_at ?? 0, data: lc });
  }

  entries.sort((a, b) => a.occurred_at - b.occurred_at);
  return entries;
}
