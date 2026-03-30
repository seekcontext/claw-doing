#!/usr/bin/env node
import { Command } from "commander";
import { registerRunsCommands } from "./commands/runs.js";
import { DB_PATH } from "../db/db.js";

const program = new Command();

program
  .name("claw-doing")
  .description("OpenClaw-first run debugger — see what your agent is doing")
  .version("0.2.0");

program
  .command("db-path")
  .description("print the path to the SQLite database")
  .action(() => {
    console.log(DB_PATH);
  });

program
  .command("tui")
  .description("open interactive TUI (Runs list + timeline inspector)")
  .action(async () => {
    const { default: React } = await import("react");
    const { render } = await import("ink");
    const { App } = await import("../tui/App.js");
    render(React.createElement(App));
  });

registerRunsCommands(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
