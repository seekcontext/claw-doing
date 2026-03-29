import { Type } from "@sinclair/typebox";
import { markStepDone } from "../store/task-store.js";
import { buildProgressBar, formatElapsed } from "../utils/format.js";

export const TaskStepDoneSchema = Type.Object({
  taskId: Type.String({ description: "The task ID returned by task_plan" }),
  stepIndex: Type.Number({ description: "The step number that was just completed" }),
  summary: Type.String({
    description: "A concise description of what was accomplished in this step",
  }),
  deviation: Type.Optional(
    Type.String({
      description:
        "Describe any unexpected finding or deviation from the original plan (optional). Leave empty if everything went as expected.",
    })
  ),
});

export type TaskStepDoneParams = {
  taskId: string;
  stepIndex: number;
  summary: string;
  deviation?: string;
};

export async function executeTaskStepDone(_id: string, params: TaskStepDoneParams) {
  const task = await markStepDone(
    params.taskId,
    params.stepIndex,
    params.summary,
    params.deviation
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
  const isLastStep = task.completedSteps === task.totalSteps;

  const lines = [
    `${bar} — elapsed: ${elapsed}`,
    ``,
    `✓ Step ${params.stepIndex}: ${params.summary}`,
  ];

  if (params.deviation) {
    lines.push(``, `⚠ Note: ${params.deviation}`);
  }

  if (!isLastStep) {
    const nextStep = task.steps.find((s) => s.status === "pending");
    if (nextStep) {
      lines.push(``, `Next: Step ${nextStep.index} — ${nextStep.description}`);
    }
  }

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}
