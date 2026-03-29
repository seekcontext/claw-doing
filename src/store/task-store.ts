import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Task, TaskStep } from "../types.js";

function getStorageDir(): string {
  return (
    process.env["CLAW_DOING_STORAGE_DIR"] ??
    join(homedir(), ".openclaw", "workspace", "claw-doing", "tasks")
  );
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function taskFilePath(taskId: string): string {
  return join(getStorageDir(), `${taskId}.json`);
}

export async function saveTask(task: Task): Promise<void> {
  const dir = getStorageDir();
  await ensureDir(dir);
  await fs.writeFile(taskFilePath(task.taskId), JSON.stringify(task, null, 2), "utf-8");
}

export async function loadTask(taskId: string): Promise<Task | null> {
  try {
    const raw = await fs.readFile(taskFilePath(taskId), "utf-8");
    return JSON.parse(raw) as Task;
  } catch {
    return null;
  }
}

export function createTask(
  title: string,
  rawSteps: Array<{ index: number; description: string; estimatedMinutes?: number }>
): Task {
  const now = new Date().toISOString();
  const steps: TaskStep[] = rawSteps.map((s) => ({
    index: s.index,
    description: s.description,
    estimatedMinutes: s.estimatedMinutes,
    status: "pending",
  }));

  return {
    taskId: crypto.randomUUID(),
    title,
    steps,
    totalSteps: steps.length,
    completedSteps: 0,
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
}

export async function markStepDone(
  taskId: string,
  stepIndex: number,
  summary: string,
  deviation?: string
): Promise<Task | null> {
  const task = await loadTask(taskId);
  if (!task) return null;

  const step = task.steps.find((s) => s.index === stepIndex);
  if (!step) return null;

  step.status = "done";
  step.summary = summary;
  step.deviation = deviation;
  step.completedAt = new Date().toISOString();

  task.completedSteps = task.steps.filter((s) => s.status === "done").length;
  task.updatedAt = new Date().toISOString();

  await saveTask(task);
  return task;
}

export async function completeTask(
  taskId: string,
  outcome: "success" | "partial" | "failed",
  summary: string,
  artifacts?: string[]
): Promise<Task | null> {
  const task = await loadTask(taskId);
  if (!task) return null;

  const statusMap: Record<typeof outcome, Task["status"]> = {
    success: "done",
    partial: "partial",
    failed: "failed",
  };

  task.status = statusMap[outcome];
  task.outcome = outcome;
  task.finalSummary = summary;
  task.artifacts = artifacts;
  task.completedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();

  await saveTask(task);
  return task;
}
