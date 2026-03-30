import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { listRuns, type RunRow } from "../../db/queries.js";
import { fmtRelativeTime, fmtDuration, fmtTokens, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

interface SessionGroup {
  sessionKey: string;
  runs: RunRow[];
  collapsed: boolean;
}

interface SessionsViewProps {
  onInspect: (runId: string) => void;
  onSwitchTab: () => void;
  onQuit: () => void;
}

// Overhead: app title(1) + statusbar(2) + buffer(1) = 4
const OVERHEAD = 4;

type NavItem =
  | { kind: "group"; groupIdx: number }
  | { kind: "run"; groupIdx: number; runIdx: number };

export function SessionsView({ onInspect, onSwitchTab, onQuit }: SessionsViewProps) {
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [cursor, setCursor] = useState(0);
  const { stdout } = useStdout();

  // Build flat navigation list from groups (rebuilt each render).
  // No findIndex needed — each item's navIndex = its position in this array.
  const navItems: NavItem[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    navItems.push({ kind: "group", groupIdx: gi });
    const g = groups[gi]!;
    if (!g.collapsed) {
      for (let ri = 0; ri < g.runs.length; ri++) {
        navItems.push({ kind: "run", groupIdx: gi, runIdx: ri });
      }
    }
  }

  // Viewport: sliding window around cursor
  const termHeight = stdout?.rows ?? 24;
  const visibleCount = Math.max(5, termHeight - OVERHEAD);
  const viewStart = Math.max(0, cursor - Math.floor(visibleCount / 2));
  const visibleItems = navItems.slice(viewStart, viewStart + visibleCount);

  const load = useCallback(() => {
    const rows = listRuns(200);
    const map = new Map<string, RunRow[]>();
    for (const r of rows) {
      const key = r.session_key ?? "(unknown session)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const gs: SessionGroup[] = [];
    for (const [key, runs] of map) {
      gs.push({ sessionKey: key, runs, collapsed: false });
    }
    setGroups(gs);
  }, []);

  useEffect(() => { load(); }, [load]);

  useInput((input, key) => {
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(navItems.length - 1, c + 1));
    else if (key.return || input === " ") {
      const item = navItems[cursor];
      if (!item) return;
      if (item.kind === "group") {
        setGroups(gs => gs.map((g, i) =>
          i === item.groupIdx ? { ...g, collapsed: !g.collapsed } : g
        ));
      } else {
        const run = groups[item.groupIdx]?.runs[item.runIdx];
        if (run) onInspect(run.id);
      }
    }
    else if (key.tab) onSwitchTab();
    else if (input === "r") load();
    else if (input === "q") onQuit();
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {groups.length === 0 && (
        <Box paddingX={1}><Text color="gray">No sessions found.</Text></Box>
      )}

      {/* Render only the visible slice of the flat navItems list.
          Each item's navIndex = viewStart + localIdx — no findIndex needed. */}
      {visibleItems.map((item, localIdx) => {
        const navIdx = viewStart + localIdx;
        const selected = cursor === navIdx;

        if (item.kind === "group") {
          const group = groups[item.groupIdx]!;
          return (
            <Box key={`group-${item.groupIdx}`} paddingX={1} backgroundColor={selected ? "blueBright" : "gray"}>
              <Text color={selected ? "black" : "white"} bold>
                {group.collapsed ? "▸" : "▾"}{" "}
              </Text>
              <Text color={selected ? "black" : "cyan"} bold>
                {truncate(group.sessionKey, 60)}
              </Text>
              <Text color={selected ? "black" : "gray"}>
                {"  "}{group.runs.length} run(s)
              </Text>
            </Box>
          );
        }

        const run = groups[item.groupIdx]!.runs[item.runIdx]!;
        const icon = statusIcon(run.status);
        const statusColor = run.status === "success" ? "green" : run.status === "error" ? "red" : "yellow";
        return (
          <Box key={run.id} paddingX={3} backgroundColor={selected ? "blueBright" : undefined}>
            <Text color={selected ? "black" : "cyan"} bold>
              {run.id.slice(0, 8)}{"  "}
            </Text>
            <Text color={selected ? "black" : "gray"}>
              {fmtRelativeTime(run.started_at)}{"  "}
            </Text>
            <Text color={selected ? "black" : statusColor}>
              {icon}{"  "}
            </Text>
            <Text color={selected ? "black" : undefined}>
              {fmtDuration(run.duration_ms)}{"  "}
            </Text>
            <Text color={selected ? "black" : "yellow"}>
              {fmtTokens(run)} tok
            </Text>
          </Box>
        );
      })}

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "navigate" },
        { key: "Enter", label: "inspect run" },
        { key: "Space", label: "expand/collapse" },
        { key: "Tab", label: "runs view" },
        { key: "r", label: "refresh" },
        { key: "q", label: "quit" },
      ]} />
    </Box>
  );
}
