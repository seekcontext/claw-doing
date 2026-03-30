import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { listRuns, type RunRow } from "../../db/queries.js";
import { fmtTimeShort, fmtDuration, fmtTokens, statusIcon, truncate } from "../format.js";
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

export function SessionsView({ onInspect, onSwitchTab, onQuit }: SessionsViewProps) {
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [cursor, setCursor] = useState(0);

  // Flat list of navigable items: group headers + run rows
  type NavItem =
    | { kind: "group"; groupIdx: number }
    | { kind: "run"; groupIdx: number; runIdx: number };

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

      {groups.map((group, gi) => {
        const groupNavIdx = navItems.findIndex(
          n => n.kind === "group" && n.groupIdx === gi
        );
        const groupSelected = cursor === groupNavIdx;

        return (
          <Box key={group.sessionKey} flexDirection="column">
            {/* group header */}
            <Box paddingX={1} backgroundColor={groupSelected ? "blueBright" : "gray"}>
              <Text color={groupSelected ? "black" : "white"} bold>
                {group.collapsed ? "▸" : "▾"}{" "}
              </Text>
              <Text color={groupSelected ? "black" : "cyan"} bold>
                {truncate(group.sessionKey, 60)}
              </Text>
              <Text color={groupSelected ? "black" : "gray"}>
                {"  "}{group.runs.length} run(s)
              </Text>
            </Box>

            {/* run rows */}
            {!group.collapsed && group.runs.map((run, ri) => {
              const runNavIdx = navItems.findIndex(
                n => n.kind === "run" && n.groupIdx === gi && n.runIdx === ri
              );
              const runSelected = cursor === runNavIdx;
              const icon = statusIcon(run.status);
              const statusColor = run.status === "success" ? "green" : run.status === "error" ? "red" : "yellow";

              return (
                <Box key={run.id} paddingX={3} backgroundColor={runSelected ? "blueBright" : undefined}>
                  <Text color={runSelected ? "black" : "cyan"} bold>
                    {run.id.slice(0, 8)}{"  "}
                  </Text>
                  <Text color={runSelected ? "black" : "gray"}>
                    {fmtTimeShort(run.started_at)}{"  "}
                  </Text>
                  <Text color={runSelected ? "black" : statusColor}>
                    {icon}{"  "}
                  </Text>
                  <Text color={runSelected ? "black" : undefined}>
                    {fmtDuration(run.duration_ms)}{"  "}
                  </Text>
                  <Text color={runSelected ? "black" : "yellow"}>
                    {fmtTokens(run)} tok
                  </Text>
                </Box>
              );
            })}
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
