export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS raw_events (
  id           TEXT PRIMARY KEY,
  hook         TEXT NOT NULL,
  run_id       TEXT,
  session_id   TEXT,
  session_key  TEXT,
  occurred_at  INTEGER NOT NULL,
  payload      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_events_run_id      ON raw_events(run_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_hook        ON raw_events(hook);
CREATE INDEX IF NOT EXISTS idx_raw_events_occurred_at ON raw_events(occurred_at);

CREATE TABLE IF NOT EXISTS runs (
  id                TEXT PRIMARY KEY,
  session_id        TEXT,
  session_key       TEXT,
  agent_id          TEXT,
  workspace_dir     TEXT,
  trigger           TEXT,
  channel_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'running',
  started_at        INTEGER,
  ended_at          INTEGER,
  duration_ms       INTEGER,
  error             TEXT,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cache_read_tokens INTEGER,
  total_tokens      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_runs_session_key ON runs(session_key);
CREATE INDEX IF NOT EXISTS idx_runs_session_id  ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_started_at  ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_runs_status      ON runs(status);

CREATE TABLE IF NOT EXISTS tool_calls (
  id               TEXT PRIMARY KEY,
  run_id           TEXT NOT NULL,
  session_id       TEXT,
  tool_call_id     TEXT NOT NULL,
  tool_name        TEXT NOT NULL,
  sequence_no      INTEGER,
  status           TEXT NOT NULL DEFAULT 'running',
  started_at       INTEGER,
  ended_at         INTEGER,
  duration_ms      INTEGER,
  params           TEXT,
  result           TEXT,
  result_truncated INTEGER NOT NULL DEFAULT 0,
  error            TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run_id     ON tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name  ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_started_at ON tool_calls(started_at);

CREATE TABLE IF NOT EXISTS llm_inputs (
  id                    TEXT PRIMARY KEY,
  run_id                TEXT NOT NULL,
  session_id            TEXT,
  provider              TEXT,
  model                 TEXT,
  occurred_at           INTEGER,
  system_prompt         TEXT,
  prompt                TEXT,
  history_message_count INTEGER,
  history_preview       TEXT
);
CREATE INDEX IF NOT EXISTS idx_llm_inputs_run_id      ON llm_inputs(run_id);
CREATE INDEX IF NOT EXISTS idx_llm_inputs_occurred_at ON llm_inputs(occurred_at);

CREATE TABLE IF NOT EXISTS llm_calls (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL,
  session_id        TEXT,
  provider          TEXT,
  model             TEXT,
  occurred_at       INTEGER,
  last_assistant    TEXT,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cache_read_tokens INTEGER,
  total_tokens      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_llm_calls_run_id ON llm_calls(run_id);
`;
