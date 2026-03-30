import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import {
  getRun,
  getTimeline,
  type RunRow,
  type TimelineEntry,
  type ToolCallRow,
  type LlmInputRow,
  type LlmCallRow,
} from "../../db/queries.js";
import { fmtTime, fmtDuration, fmtTokensFull, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

// Overhead: app title(1) + run header block(7) + stats bar(1) + timeline header(3) + statusbar(2) = 14
const HEADER_OVERHEAD = 14;
const LINES_PER_ENTRY = 2;

interface RunInspectProps {
  runId: string;
  onBack: () => void;
  onExpandEntry: (entry: TimelineEntry) => void;
}

export function RunInspect({ runId, onBack, onExpandEntry }: RunInspectProps) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [allEntries, setAllEntries] = useState<TimelineEntry[]>([]);
  const [toolsOnly, setToolsOnly] = useState(false);
  const [cursor, setCursor] = useState(0);
  const { stdout } = useStdout();

  useEffect(() => {
    try {
      const r = getRun(runId);
      setRun(r);
      if (r) {
        setAllEntries(getTimeline(r.id));
        setCursor(0);
      }
    } catch {
      // ignore
    }
  }, [runId]);

  const entries = toolsOnly
    ? allEntries.filter(e => e.type === "tool_call")
    : allEntries;

  // Summary stats computed from allEntries (no extra DB query)
  const toolCallRows = allEntries
    .filter(e => e.type === "tool_call")
    .map(e => e.data as ToolCallRow);
  const llmInputCount = allEntries.filter(e => e.type === "llm_input").length;
  const errorCount = toolCallRows.filter(tc => tc.status === "error").length;
  const slowest = toolCallRows.reduce<ToolCallRow | null>(
    (max, tc) => !max || (tc.duration_ms ?? 0) > (max.duration_ms ?? 0) ? tc : max,
    null
  );
  const statsParts = [
    `${toolCallRows.length} tool call${toolCallRows.length !== 1 ? "s" : ""}`,
    `${llmInputCount} LLM request${llmInputCount !== 1 ? "s" : ""}`,
    errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? "s" : ""}` : null,
    slowest?.duration_ms ? `slowest: ${slowest.tool_name} (${fmtDuration(slowest.duration_ms)})` : null,
  ].filter(Boolean).join("  ·  ");

  // Viewport: sliding window around cursor
  const termHeight = stdout?.rows ?? 24;
  const visibleEntryCount = Math.max(3, Math.floor((termHeight - HEADER_OVERHEAD) / LINES_PER_ENTRY));
  const viewStart = Math.max(0, cursor - Math.floor(visibleEntryCount / 2));
  const visibleEntries = entries.slice(viewStart, viewStart + visibleEntryCount);

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(entries.length - 1, c + 1));
    else if (input === "g") setCursor(0);
    else if (input === "G") setCursor(Math.max(0, entries.length - 1));
    else if (key.return && entries.length > 0) onExpandEntry(entries[cursor]!);
    else if (key.escape || key.leftArrow) onBack();
    else if (input === "t") { setToolsOnly(v => !v); setCursor(0); }
  });

  if (!run) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text color="red">Run not found: {runId}</Text>
        <Box flexGrow={1} />
        <StatusBar hints={[{ key: "Esc", label: "back" }]} />
      </Box>
    );
  }

  const icon = statusIcon(run.status);
  const statusColor = run.status === "success" ? "green" : run.status === "error" ? "red" : "yellow";

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* run header */}
      <Box flexDirection="column" paddingX={1} marginBottom={1}>
        <Box>
          <Text bold color="cyan">Run  </Text>
          <Text bold>{run.id}</Text>
        </Box>
        <Box>
          <Text color="gray">{"─".repeat(72)}</Text>
        </Box>
        <Box gap={4} flexWrap="wrap">
          <Box gap={1}>
            <Text color="gray">Status  </Text>
            <Text color={statusColor} bold>{icon} {run.status}{run.error ? `  — ${truncate(run.error, 60)}` : ""}</Text>
          </Box>
          <Box gap={1}>
            <Text color="gray">Duration</Text>
            <Text>{fmtDuration(run.duration_ms)}</Text>
          </Box>
          <Box gap={1}>
            <Text color="gray">Started </Text>
            <Text>{fmtTime(run.started_at)}</Text>
          </Box>
        </Box>
        <Box gap={4}>
          <Box gap={1}>
            <Text color="gray">Tokens  </Text>
            <Text color="yellow">{fmtTokensFull(run)}</Text>
          </Box>
        </Box>
        <Box gap={1}>
          <Text color="gray">Session </Text>
          <Text color="gray">{run.session_key ?? "—"}</Text>
        </Box>
        {run.trigger && (
          <Box gap={1}>
            <Text color="gray">Trigger </Text>
            <Text>{run.trigger}</Text>
          </Box>
        )}
      </Box>

      {/* stats summary bar */}
      {allEntries.length > 0 && (
        <Box paddingX={1} marginBottom={1}>
          <Text color="gray">{statsParts}</Text>
          {toolsOnly && <Text color="yellow">  [tools only]</Text>}
        </Box>
      )}

      {/* timeline header */}
      <Box paddingX={1}>
        <Text bold color="gray">Timeline</Text>
      </Box>
      <Box paddingX={1} marginBottom={1}>
        <Text color="gray">{"─".repeat(72)}</Text>
      </Box>

      {entries.length === 0 && (
        <Box paddingX={1}><Text color="gray">No events recorded for this run.</Text></Box>
      )}

      {visibleEntries.map((entry, localIdx) => {
        const i = viewStart + localIdx;
        return <TimelineRow key={i} entry={entry} selected={i === cursor} />;
      })}

      {entries.length > visibleEntryCount && (
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            {viewStart + 1}–{viewStart + visibleEntries.length} of {entries.length} events
            {viewStart + visibleEntries.length < entries.length ? "  ↓ more below" : "  (end)"}
          </Text>
        </Box>
      )}

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "scroll" },
        { key: "g/G", label: "top/bottom" },
        { key: "Enter", label: "expand" },
        { key: "t", label: toolsOnly ? "all events" : "tools only" },
        { key: "Esc/←", label: "back" },
      ]} />
    </Box>
  );
}

function TimelineRow({ entry, selected }: { entry: TimelineEntry; selected: boolean }) {
  const bg = selected ? "blueBright" : undefined;
  const textColor = selected ? "black" : undefined;

  if (entry.type === "llm_input") {
    const li = entry.data as LlmInputRow;
    const model = li.model ?? li.provider ?? "unknown";
    return (
      <Box paddingX={1} backgroundColor={bg}>
        <Text color={selected ? "black" : "gray"}>{fmtTime(entry.occurred_at).slice(11)}  </Text>
        <Text color={selected ? "black" : "cyan"} bold>{"→ "}</Text>
        <Box flexDirection="column">
          <Text color={selected ? "black" : "cyan"} bold>LLM Request → {model}</Text>
          <Text color={selected ? "black" : "gray"}>
            {li.system_prompt ? `System: ${truncate(li.system_prompt, 60)}  ` : ""}
            {li.prompt ? `Prompt: ${truncate(li.prompt, 60)}` : ""}
            {li.history_message_count != null ? `  · ${li.history_message_count} msgs` : ""}
          </Text>
        </Box>
      </Box>
    );
  }

  if (entry.type === "tool_call") {
    const tc = entry.data as ToolCallRow;
    const okColor = tc.status === "success" ? "green" : tc.status === "error" ? "red" : "yellow";
    const icon = tc.status === "success" ? "✓" : tc.status === "error" ? "✗" : "…";
    return (
      <Box paddingX={1} backgroundColor={bg}>
        <Text color={selected ? "black" : "gray"}>{fmtTime(entry.occurred_at).slice(11)}  </Text>
        <Text color={selected ? "black" : okColor} bold>{icon + " "}</Text>
        <Box flexDirection="column">
          <Box gap={2}>
            <Text color={textColor} bold>{tc.tool_name}</Text>
            <Text color={selected ? "black" : "gray"}>({tc.tool_call_id})  {fmtDuration(tc.duration_ms)}</Text>
          </Box>
          {tc.params && (
            <Text color={selected ? "black" : "gray"}>
              {truncate(tc.params.replace(/\s+/g, " "), 80)}
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  if (entry.type === "llm_output") {
    const lc = entry.data as LlmCallRow;
    const model = lc.model ?? lc.provider ?? "unknown";
    const tok = lc.total_tokens ? `  [${lc.input_tokens ?? 0} in / ${lc.output_tokens ?? 0} out]` : "";
    return (
      <Box paddingX={1} backgroundColor={bg}>
        <Text color={selected ? "black" : "gray"}>{fmtTime(entry.occurred_at).slice(11)}  </Text>
        <Text color={selected ? "black" : "green"} bold>{"← "}</Text>
        <Box flexDirection="column">
          <Text color={selected ? "black" : "green"} bold>LLM Response ← {model}<Text color={selected ? "black" : "yellow"}>{tok}</Text></Text>
          {lc.last_assistant && (
            <Text color={selected ? "black" : "gray"}>Reply: {truncate(lc.last_assistant, 80)}</Text>
          )}
        </Box>
      </Box>
    );
  }

  return null;
}
