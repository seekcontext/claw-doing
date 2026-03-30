import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import {
  listActiveRuns,
  getTimeline,
  type RunRow,
  type TimelineEntry,
  type ToolCallRow,
  type LlmInputRow,
  type LlmCallRow,
} from "../../db/queries.js";
import { fmtTime, fmtDuration, fmtTokensFull, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

interface LiveViewProps {
  onBack: () => void;
}

// Overhead: title(2) + separator(1) + run header(3) + timeline header(2) + footer(2) = 10
const OVERHEAD = 10;

export function LiveView({ onBack }: LiveViewProps) {
  const [activeRun, setActiveRun] = useState<RunRow | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [tick, setTick] = useState(0);
  const { stdout } = useStdout();

  const poll = useCallback(() => {
    const runs = listActiveRuns();
    if (runs.length === 0) {
      // No active runs — check if we had one previously (just finished)
      setActiveRun(prev => {
        if (prev && prev.status === "running") {
          // Run just completed — keep showing it briefly (state update will come next poll)
        }
        return null;
      });
      setEntries([]);
    } else {
      const run = runs[0]!;
      setActiveRun(run);
      setEntries(getTimeline(run.id));
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      poll();
      setTick(t => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [poll]);

  useInput((_input, key) => {
    if (key.escape || key.leftArrow) onBack();
  });

  // Spinner: cycle through dots every tick
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][tick % 10]!;

  // Viewport: show the last N entries that fit on screen
  const termHeight = stdout?.rows ?? 24;
  const maxEntries = Math.max(3, termHeight - OVERHEAD);
  const displayEntries = entries.slice(-maxEntries);
  const hiddenCount = entries.length - displayEntries.length;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* live header */}
      <Box paddingX={1}>
        <Text bold color="cyan">Live View  </Text>
        <Text color="gray">{spinner} polling every 2s</Text>
      </Box>
      <Box paddingX={1} marginBottom={1}>
        <Text color="gray">{"─".repeat(72)}</Text>
      </Box>

      {!activeRun && (
        <Box paddingX={1} marginTop={1}>
          <Text color="yellow">{spinner} No active run. Waiting for agent to start…</Text>
        </Box>
      )}

      {activeRun && (
        <>
          {/* run metadata */}
          <Box paddingX={1} flexDirection="column" marginBottom={1}>
            <Box gap={2}>
              <Text bold color="cyan">Run</Text>
              <Text bold>{activeRun.id.slice(0, 12)}…</Text>
              <Text color={activeRun.status === "running" ? "yellow" : "green"} bold>
                {statusIcon(activeRun.status)} {activeRun.status}
              </Text>
              <Text color="gray">started {fmtTime(activeRun.started_at).slice(11)}</Text>
            </Box>
            <Box gap={1}>
              <Text color="gray">Session</Text>
              <Text color="gray">{truncate(activeRun.session_key, 60)}</Text>
            </Box>
            {activeRun.total_tokens && (
              <Box gap={1}>
                <Text color="gray">Tokens </Text>
                <Text color="yellow">{fmtTokensFull(activeRun)}</Text>
              </Box>
            )}
          </Box>

          {/* timeline */}
          <Box paddingX={1}>
            <Text bold color="gray">Timeline ({entries.length} events)</Text>
            {hiddenCount > 0 && <Text color="gray" dimColor>  ↑ {hiddenCount} earlier events hidden</Text>}
          </Box>
          <Box paddingX={1} marginBottom={1}>
            <Text color="gray">{"─".repeat(72)}</Text>
          </Box>

          {displayEntries.map((entry, i) => (
            <LiveEntryRow key={i} entry={entry} />
          ))}
        </>
      )}

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "Esc/←", label: "back to runs" },
      ]} />
    </Box>
  );
}

function LiveEntryRow({ entry }: { entry: TimelineEntry }) {
  const time = fmtTime(entry.occurred_at).slice(11);

  if (entry.type === "llm_input") {
    const li = entry.data as LlmInputRow;
    return (
      <Box paddingX={1}>
        <Text color="gray">{time}  </Text>
        <Text color="cyan" bold>→ LLM → {li.model ?? li.provider ?? "unknown"}</Text>
        {li.history_message_count != null && (
          <Text color="gray">  {li.history_message_count} msgs in history</Text>
        )}
      </Box>
    );
  }

  if (entry.type === "tool_call") {
    const tc = entry.data as ToolCallRow;
    const color = tc.status === "success" ? "green" : tc.status === "error" ? "red" : "yellow";
    const icon = tc.status === "success" ? "✓" : tc.status === "error" ? "✗" : "…";
    return (
      <Box paddingX={1}>
        <Text color="gray">{time}  </Text>
        <Text color={color} bold>{icon} {tc.tool_name}</Text>
        <Text color="gray">  ({tc.tool_call_id})  {fmtDuration(tc.duration_ms)}</Text>
      </Box>
    );
  }

  if (entry.type === "llm_output") {
    const lc = entry.data as LlmCallRow;
    const tok = lc.total_tokens ? `  [${lc.input_tokens ?? 0} in / ${lc.output_tokens ?? 0} out]` : "";
    return (
      <Box paddingX={1}>
        <Text color="gray">{time}  </Text>
        <Text color="green" bold>← LLM response{tok}</Text>
      </Box>
    );
  }

  return null;
}
