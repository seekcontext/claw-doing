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

registerRunsCommands(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
