import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { listRuns, type RunRow } from "../../db/queries.js";
import { fmtRelativeTime, fmtDuration, fmtTokens, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

interface RunsListProps {
  onInspect: (runId: string) => void;
  onSwitchTab: () => void;
  onLive: () => void;
  onQuit: () => void;
}

const COL = { id: 8, time: 10, dur: 6, status: 9, tokens: 7 };
const OVERHEAD = 8; // app title(1) + col header(1) + separator(1) + count(1) + marginTop(1) + statusbar(2) + buffer(1)

function statusColor(status: string): string {
  if (status === "success") return "green";
  if (status === "error") return "red";
  return "yellow";
}

export function RunsList({ onInspect, onSwitchTab, onLive, onQuit }: RunsListProps) {
  const [allRuns, setAllRuns] = useState<RunRow[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchStr, setSearchStr] = useState("");
  const { stdout } = useStdout();

  const load = useCallback(() => {
    setLoading(true);
    try {
      const rows = listRuns(50);
      setAllRuns(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply filters in memory — no extra DB query
  const runs = allRuns.filter(r => {
    if (errorsOnly && r.status !== "error") return false;
    if (searchStr && !(r.session_key ?? "").toLowerCase().includes(searchStr.toLowerCase())) return false;
    return true;
  });

  // Reset cursor to top whenever active filters change
  useEffect(() => { setCursor(0); }, [errorsOnly, searchStr]);

  // Viewport: sliding window around cursor
  const termHeight = stdout?.rows ?? 24;
  const visibleCount = Math.max(5, termHeight - OVERHEAD);
  const viewStart = Math.max(0, cursor - Math.floor(visibleCount / 2));
  const visibleRuns = runs.slice(viewStart, viewStart + visibleCount);

  useInput((input, key) => {
    // In search mode: accumulate characters; Enter confirms, Esc cancels
    if (searchMode) {
      if (key.escape) { setSearchMode(false); setSearchStr(""); }
      else if (key.return) { setSearchMode(false); }
      else if (key.backspace || key.delete) { setSearchStr(s => s.slice(0, -1)); }
      else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setSearchStr(s => s + input);
      }
      return;
    }

    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(runs.length - 1, c + 1));
    else if (input === "g") setCursor(0);
    else if (input === "G") setCursor(Math.max(0, runs.length - 1));
    else if (key.return && runs.length > 0) onInspect(runs[cursor]!.id);
    else if (input === "e") setErrorsOnly(v => !v);
    else if (input === "/") { setSearchMode(true); setSearchStr(""); }
    else if (input === "l") onLive();
    else if (input === "r") load();
    else if (input === "q") onQuit();
    else if (key.tab) onSwitchTab();
  });

  const showingAll = visibleRuns.length >= runs.length;
  const filterParts: string[] = [];
  if (errorsOnly) filterParts.push("errors only");
  if (searchStr) filterParts.push(`"${searchStr}"`);
  const filterLabel = filterParts.length > 0 ? `  [filter: ${filterParts.join(", ")}]` : "";
  const countText = showingAll
    ? `${runs.length} run(s)${filterLabel}`
    : `${runs.length} run(s)  ·  ${viewStart + 1}–${viewStart + visibleRuns.length}${filterLabel}`;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* search input bar — shown only when active */}
      {searchMode && (
        <Box paddingX={1} backgroundColor="yellow">
          <Text color="black" bold>/ </Text>
          <Text color="black">{searchStr || " "}</Text>
          <Text color="black" dimColor>  Enter=confirm  Esc=cancel</Text>
        </Box>
      )}

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
          <Text color="yellow">
            {filterParts.length > 0
              ? "No runs match the current filter."
              : "No runs found. Make sure ClawDoing plugin is enabled in OpenClaw."}
          </Text>
        </Box>
      )}

      {!loading && visibleRuns.map((run, localIdx) => {
        const i = viewStart + localIdx;
        const selected = i === cursor;
        const icon = statusIcon(run.status);
        const color = statusColor(run.status);

        return (
          <Box key={run.id} paddingX={1} backgroundColor={selected ? "blueBright" : undefined}>
            <Text color={selected ? "black" : "cyan"} bold>
              {run.id.slice(0, COL.id).padEnd(COL.id + 2)}
            </Text>
            <Text color={selected ? "black" : undefined}>
              {fmtRelativeTime(run.started_at).padEnd(COL.time + 2)}
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
        <Text color="gray">{countText}</Text>
      </Box>

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "navigate" },
        { key: "g/G", label: "top/bottom" },
        { key: "Enter", label: "inspect" },
        { key: "e", label: errorsOnly ? "all runs" : "errors only" },
        { key: "/", label: "search" },
        { key: "l", label: "live" },
        { key: "Tab", label: "sessions" },
        { key: "r/q", label: "refresh/quit" },
      ]} />
    </Box>
  );
}
