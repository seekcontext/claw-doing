// NOTE: import path should be verified on the server.
// If build fails, check the openclaw package exports with:
//   cat $(pnpm root -g)/openclaw/package.json | grep -A 30 '"exports"'
// and adjust accordingly (e.g. 'openclaw/dist/plugin-sdk/core').
import { definePluginEntry } from "openclaw/plugin-sdk/core";

import {
  ingestBeforeAgentStart,
  ingestAgentEnd,
  ingestBeforeToolCall,
  ingestAfterToolCall,
  ingestLlmInput,
  ingestLlmOutput,
  ingestRawOnly,
} from "./db/ingest.js";

export default definePluginEntry({
  id: "claw-doing",
  name: "ClawDoing",
  description: "OpenClaw-first run debugger — captures agent events for inspection",
  register(api) {
    api.on("session_start",  (e, ctx) => ingestRawOnly("session_start", e, ctx));
    api.on("session_end",    (e, ctx) => ingestRawOnly("session_end", e, ctx));

    api.on("before_agent_start", (e, ctx) => ingestBeforeAgentStart(e, ctx));
    api.on("agent_end",          (e, ctx) => ingestAgentEnd(e, ctx));

    api.on("llm_input",  (e, ctx) => ingestLlmInput(e, ctx));
    api.on("llm_output", (e, ctx) => ingestLlmOutput(e, ctx));

    api.on("before_tool_call", (e, ctx) => ingestBeforeToolCall(e, ctx));
    api.on("after_tool_call",  (e, ctx) => ingestAfterToolCall(e, ctx));

    api.on("subagent_spawned", (e, ctx) => ingestRawOnly("subagent_spawned", e, ctx));
    api.on("subagent_ended",   (e, ctx) => ingestRawOnly("subagent_ended", e, ctx));

    api.on("gateway_start", (e, ctx) => ingestRawOnly("gateway_start", e, ctx));
    api.on("gateway_stop",  (e, ctx) => ingestRawOnly("gateway_stop", e, ctx));
  },
});
