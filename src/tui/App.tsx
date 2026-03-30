import React, { useState } from "react";
import { Box, Text, useApp } from "ink";
import { type TimelineEntry } from "../db/queries.js";
import { RunsList } from "./screens/RunsList.js";
import { RunInspect } from "./screens/RunInspect.js";
import { EntryDetail } from "./screens/EntryDetail.js";
import { SessionsView } from "./screens/SessionsView.js";

type Tab = "runs" | "sessions";

type Screen =
  | { name: "list" }
  | { name: "inspect"; runId: string }
  | { name: "detail"; runId: string; entry: TimelineEntry };

export function App() {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>("runs");
  const [screen, setScreen] = useState<Screen>({ name: "list" });

  const handleInspect = (runId: string) => {
    setScreen({ name: "inspect", runId });
  };

  const handleExpandEntry = (runId: string, entry: TimelineEntry) => {
    setScreen({ name: "detail", runId, entry });
  };

  const handleBackToList = () => {
    setScreen({ name: "list" });
  };

  const handleBackToInspect = (runId: string) => {
    setScreen({ name: "inspect", runId });
  };

  const handleSwitchTab = () => {
    setTab(t => t === "runs" ? "sessions" : "runs");
    setScreen({ name: "list" });
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* title bar */}
      <Box paddingX={1} backgroundColor="blue">
        <Text bold color="white">ClawDoing </Text>
        <Text color="blueBright">— see what OpenClaw is doing</Text>
        <Box flexGrow={1} />
        <Text color={tab === "runs" ? "white" : "gray"} bold={tab === "runs"}> [Runs] </Text>
        <Text color={tab === "sessions" ? "white" : "gray"} bold={tab === "sessions"}> [Sessions] </Text>
      </Box>

      {/* screens */}
      {screen.name === "list" && tab === "runs" && (
        <RunsList
          onInspect={handleInspect}
          onSwitchTab={handleSwitchTab}
          onQuit={() => exit()}
        />
      )}
      {screen.name === "list" && tab === "sessions" && (
        <SessionsView
          onInspect={handleInspect}
          onSwitchTab={handleSwitchTab}
          onQuit={() => exit()}
        />
      )}
      {screen.name === "inspect" && (
        <RunInspect
          runId={screen.runId}
          onBack={handleBackToList}
          onExpandEntry={(entry) => handleExpandEntry(screen.runId, entry)}
        />
      )}
      {screen.name === "detail" && (
        <EntryDetail
          entry={screen.entry}
          onBack={() => handleBackToInspect(screen.runId)}
        />
      )}
    </Box>
  );
}
