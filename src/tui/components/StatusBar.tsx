import React from "react";
import { Box, Text } from "ink";

export interface KeyHint {
  key: string;
  label: string;
}

interface StatusBarProps {
  hints: KeyHint[];
}

export function StatusBar({ hints }: StatusBarProps) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      {hints.map((h, i) => (
        <Box key={i} marginRight={3}>
          <Text bold color="blueBright">{h.key}</Text>
          <Text color="gray"> {h.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
