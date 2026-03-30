import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
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

interface RunInspectProps {
  runId: string;
  onBack: () => void;
  onExpandEntry: (entry: TimelineEntry) => void;
  toolsOnly?: boolean;
}

export function RunInspect({ runId, onBack, onExpandEntry, toolsOnly = false }: RunInspectProps) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    try {
      const r = getRun(runId);
      setRun(r);
      if (r) {
        let timeline = getTimeline(r.id);
        if (toolsOnly) timeline = timeline.filter(e => e.type === "tool_call");
        setEntries(timeline);
      }
    } catch {
      // ignore
    }
  }, [runId, toolsOnly]);

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(entries.length - 1, c + 1));
    else if (key.return && entries.length > 0) onExpandEntry(entries[cursor]!);
    else if (key.escape || (key.leftArrow)) onBack();
    else if (input === "t") {
      // toggle handled at App level — no-op here
    }
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

      {entries.map((entry, i) => (
        <TimelineRow key={i} entry={entry} selected={i === cursor} />
      ))}

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "scroll" },
        { key: "Enter", label: "expand" },
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
