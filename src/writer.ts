import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const OUTPUT_PATH = join(homedir(), ".openclaw", "claw-doing-events.jsonl");

function ensureOutputDir(): void {
  const dir = dirname(OUTPUT_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

ensureOutputDir();

export function append(
  hook: string,
  event: unknown,
  ctx: unknown
): void {
  const line = JSON.stringify({ hook, ts: Date.now(), event, ctx }) + "\n";
  try {
    appendFileSync(OUTPUT_PATH, line, { encoding: "utf8" });
  } catch {
    // Silent fail — never let ClawDoing break OpenClaw
  }
}
