// NOTE: import path should be verified on the server.
// If build fails, check the openclaw package exports with:
//   cat $(pnpm root -g)/openclaw/package.json | grep -A 30 '"exports"'
// and adjust accordingly (e.g. 'openclaw/dist/plugin-sdk/core').
import { definePluginEntry } from "openclaw/plugin-sdk/core";

import { append } from "./writer.js";

export default definePluginEntry({
  id: "claw-doing",
  name: "ClawDoing",
  description: "OpenClaw-first run debugger — captures agent events for inspection",
  register(api) {
    api.on("session_start", (e, ctx) => append("session_start", e, ctx));
    api.on("session_end", (e, ctx) => append("session_end", e, ctx));

    api.on("before_agent_start", (e, ctx) => append("before_agent_start", e, ctx));
    api.on("agent_end", (e, ctx) => append("agent_end", e, ctx));

    api.on("llm_input", (e, ctx) => append("llm_input", e, ctx));
    api.on("llm_output", (e, ctx) => append("llm_output", e, ctx));

    api.on("before_tool_call", (e, ctx) => append("before_tool_call", e, ctx));
    api.on("after_tool_call", (e, ctx) => append("after_tool_call", e, ctx));

    api.on("subagent_spawned", (e, ctx) => append("subagent_spawned", e, ctx));
    api.on("subagent_ended", (e, ctx) => append("subagent_ended", e, ctx));

    api.on("gateway_start", (e, ctx) => append("gateway_start", e, ctx));
    api.on("gateway_stop", (e, ctx) => append("gateway_stop", e, ctx));
  },
});
