import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { listRuns, type RunRow } from "../../db/queries.js";
import { fmtTimeShort, fmtDuration, fmtTokens, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

interface RunsListProps {
  onInspect: (runId: string) => void;
  onSwitchTab: () => void;
  onQuit: () => void;
}

const COL = { id: 8, time: 14, dur: 6, status: 9, tokens: 7 };

function statusColor(status: string): string {
  if (status === "success") return "green";
  if (status === "error") return "red";
  return "yellow";
}

export function RunsList({ onInspect, onSwitchTab, onQuit }: RunsListProps) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const rows = listRuns(50);
      setRuns(rows);
      setCursor(c => Math.min(c, Math.max(0, rows.length - 1)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(runs.length - 1, c + 1));
    else if (key.return && runs.length > 0) onInspect(runs[cursor]!.id);
    else if (input === "r") load();
    else if (input === "q") onQuit();
    else if (key.tab) onSwitchTab();
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* header row */}
      <Box paddingX={1} marginBottom={0}>
        <Text bold color="gray">{" ID".padEnd(COL.id + 2)}</Text>
        <Text bold color="gray">{"STARTED".padEnd(COL.time + 2)}</Text>
        <Text bold color="gray">{"DUR".padEnd(COL.dur + 2)}</Text>
        <Text bold color="gray">{"STATUS".padEnd(COL.status + 2)}</Text>
        <Text bold color="gray">{"TOKENS".padEnd(COL.tokens + 2)}</Text>
        <Text bold color="gray">SESSION KEY</Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(90)}</Text>
      </Box>

      {loading && <Box paddingX={1}><Text color="gray">Loading…</Text></Box>}

      {!loading && runs.length === 0 && (
        <Box paddingX={1}>
          <Text color="yellow">No runs found. Make sure ClawDoing plugin is enabled in OpenClaw.</Text>
        </Box>
      )}

      {!loading && runs.map((run, i) => {
        const selected = i === cursor;
        const icon = statusIcon(run.status);
        const color = statusColor(run.status);

        return (
          <Box key={run.id} paddingX={1} backgroundColor={selected ? "blueBright" : undefined}>
            <Text color={selected ? "black" : "cyan"} bold>
              {run.id.slice(0, COL.id).padEnd(COL.id + 2)}
            </Text>
            <Text color={selected ? "black" : undefined}>
              {fmtTimeShort(run.started_at).padEnd(COL.time + 2)}
            </Text>
            <Text color={selected ? "black" : undefined}>
              {fmtDuration(run.duration_ms).padEnd(COL.dur + 2)}
            </Text>
            <Text color={selected ? "black" : color}>
              {`${icon} ${run.status}`.padEnd(COL.status + 2)}
            </Text>
            <Text color={selected ? "black" : "yellow"}>
              {fmtTokens(run).padEnd(COL.tokens + 2)}
            </Text>
            <Text color={selected ? "black" : "gray"}>
              {truncate(run.session_key, 50)}
            </Text>
          </Box>
        );
      })}

      <Box paddingX={1} marginTop={1}>
        <Text color="gray">{runs.length} run(s)</Text>
      </Box>

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "navigate" },
        { key: "Enter", label: "inspect" },
        { key: "Tab", label: "sessions" },
        { key: "r", label: "refresh" },
        { key: "q", label: "quit" },
      ]} />
    </Box>
  );
}
