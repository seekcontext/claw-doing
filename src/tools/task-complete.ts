import { Type } from "@sinclair/typebox";
import { completeTask } from "../store/task-store.js";
import { buildProgressBar, formatElapsed, formatOutcome } from "../utils/format.js";

export const TaskCompleteSchema = Type.Object({
  taskId: Type.String({ description: "The task ID returned by task_plan" }),
  outcome: Type.Union(
    [Type.Literal("success"), Type.Literal("partial"), Type.Literal("failed")],
    {
      description:
        "'success' if all steps completed as planned, 'partial' if some steps had issues but useful output was produced, 'failed' if the task could not be completed",
    }
  ),
  summary: Type.String({
    description:
      "A clear, user-facing summary of what was accomplished. Include key numbers, findings, or decisions made.",
  }),
  artifacts: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "List of output file paths, URLs, or named results produced by this task (e.g. 'memory/2026-03-29-report.md')",
    })
  ),
});

export type TaskCompleteParams = {
  taskId: string;
  outcome: "success" | "partial" | "failed";
  summary: string;
  artifacts?: string[];
};

export async function executeTaskComplete(_id: string, params: TaskCompleteParams) {
  const task = await completeTask(
    params.taskId,
    params.outcome,
    params.summary,
    params.artifacts
  );

  if (!task) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Task \`${params.taskId}\` not found. Please check the task ID.`,
        },
      ],
    };
  }

  const bar = buildProgressBar(task.completedSteps, task.totalSteps);
  const elapsed = formatElapsed(task.createdAt);
  const outcomeLabel = formatOutcome(params.outcome);

  const lines = [
    `${bar} — ${elapsed} total`,
    ``,
    `${outcomeLabel}`,
    ``,
    params.summary,
  ];

  if (params.artifacts && params.artifacts.length > 0) {
    lines.push(``, `Deliverables:`);
    params.artifacts.forEach((a) => lines.push(`  • ${a}`));
  }

  const failedSteps = task.steps.filter((s) => s.status === "failed");
  if (failedSteps.length > 0) {
    lines.push(``, `Incomplete steps:`);
    failedSteps.forEach((s) => lines.push(`  • Step ${s.index}: ${s.description}`));
  }

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}
