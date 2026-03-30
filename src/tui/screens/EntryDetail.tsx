import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  type TimelineEntry,
  type ToolCallRow,
  type LlmInputRow,
  type LlmCallRow,
} from "../../db/queries.js";
import { fmtTime, fmtDuration, statusIcon, truncate } from "../format.js";
import { StatusBar } from "../components/StatusBar.js";

interface EntryDetailProps {
  entry: TimelineEntry;
  onBack: () => void;
}

const SCROLL_STEP = 3;

export function EntryDetail({ entry, onBack }: EntryDetailProps) {
  const [scrollOffset, setScrollOffset] = useState(0);

  const lines = buildLines(entry);
  const maxScroll = Math.max(0, lines.length - 20);

  useInput((_input, key) => {
    if (key.upArrow) setScrollOffset(s => Math.max(0, s - SCROLL_STEP));
    else if (key.downArrow) setScrollOffset(s => Math.min(maxScroll, s + SCROLL_STEP));
    else if (key.escape || key.leftArrow) onBack();
  });

  const visible = lines.slice(scrollOffset, scrollOffset + 30);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="cyan">{entryTitle(entry)}</Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(72)}</Text>
      </Box>

      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visible.map((line, i) => (
          <Text key={i + scrollOffset} color={line.color ?? undefined}>{line.text}</Text>
        ))}
        {maxScroll > 0 && (
          <Text color="gray" dimColor>
            {scrollOffset < maxScroll
              ? `  ↓ more (${lines.length - scrollOffset - 30} lines below)`
              : "  (end)"}
          </Text>
        )}
      </Box>

      <Box flexGrow={1} />
      <StatusBar hints={[
        { key: "↑↓", label: "scroll" },
        { key: "Esc/←", label: "back to timeline" },
      ]} />
    </Box>
  );
}

interface Line { text: string; color?: string }

function entryTitle(entry: TimelineEntry): string {
  if (entry.type === "tool_call") {
    const tc = entry.data as ToolCallRow;
    const icon = statusIcon(tc.status);
    return `${icon} Tool Call — ${tc.tool_name}  (${tc.tool_call_id})  ${fmtDuration(tc.duration_ms)}  · ${fmtTime(entry.occurred_at)}`;
  }
  if (entry.type === "llm_input") {
    const li = entry.data as LlmInputRow;
    return `→ LLM Request — ${li.model ?? li.provider ?? "unknown"}  · ${fmtTime(entry.occurred_at)}`;
  }
  if (entry.type === "llm_output") {
    const lc = entry.data as LlmCallRow;
    const tok = lc.total_tokens ? `  [${lc.input_tokens ?? 0} in / ${lc.output_tokens ?? 0} out]` : "";
    return `← LLM Response — ${lc.model ?? lc.provider ?? "unknown"}${tok}  · ${fmtTime(entry.occurred_at)}`;
  }
  return "Entry Detail";
}

function prettyJson(json: string | null | undefined): string[] {
  if (!json) return ["(none)"];
  try {
    return JSON.stringify(JSON.parse(json), null, 2).split("\n");
  } catch {
    return json.split("\n");
  }
}

function section(label: string, lines: Line[]): Line[] {
  return [
    { text: "" },
    { text: `── ${label} `, color: "gray" },
    { text: "─".repeat(64), color: "gray" },
    ...lines,
  ];
}

function buildLines(entry: TimelineEntry): Line[] {
  const out: Line[] = [];

  if (entry.type === "tool_call") {
    const tc = entry.data as ToolCallRow;
    out.push(...section("PARAMS", prettyJson(tc.params).map(t => ({ text: t }))));
    if (tc.status === "error" && tc.error) {
      out.push(...section("ERROR", [{ text: tc.error, color: "red" }]));
    }
    out.push(...section(
      `RESULT${tc.result_truncated ? " [truncated to 8KB — full content in raw_events]" : ""}`,
      prettyJson(tc.result).map(t => ({ text: t, color: tc.result_truncated ? "yellow" : undefined })),
    ));
    return out;
  }

  if (entry.type === "llm_input") {
    const li = entry.data as LlmInputRow;
    out.push(...section("SYSTEM PROMPT", (li.system_prompt ?? "(none)").split("\n").map(t => ({ text: t }))));
    out.push(...section("USER PROMPT", (li.prompt ?? "(none)").split("\n").map(t => ({ text: t }))));
    out.push(...section("HISTORY", [
      { text: `${li.history_message_count ?? 0} message(s) in history`, color: "gray" },
      ...prettyJson(li.history_preview).map(t => ({ text: t, color: "gray" as string })),
    ]));
    return out;
  }

  if (entry.type === "llm_output") {
    const lc = entry.data as LlmCallRow;
    out.push(...section("FINAL REPLY", (lc.last_assistant ?? "(none)").split("\n").map(t => ({ text: t }))));
    out.push(...section("TOKEN USAGE", [
      { text: `Input   : ${lc.input_tokens ?? 0}` },
      { text: `Output  : ${lc.output_tokens ?? 0}` },
      { text: `Cached  : ${lc.cache_read_tokens ?? 0}` },
      { text: `Total   : ${lc.total_tokens ?? 0}`, color: "yellow" },
    ]));
    return out;
  }

  return [{ text: "(no detail available)" }];
}
