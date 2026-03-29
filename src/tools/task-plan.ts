import { Type } from "@sinclair/typebox";
import { createTask, saveTask } from "../store/task-store.js";
import { buildProgressBar, formatDuration } from "../utils/format.js";

export const TaskPlanSchema = Type.Object({
  title: Type.String({
    description: "A short title describing the overall task (e.g. 'Research AI agent frameworks')",
  }),
  steps: Type.Array(
    Type.Object({
      index: Type.Number({ description: "Step number, starting from 1" }),
      description: Type.String({ description: "What this step does" }),
      estimatedMinutes: Type.Optional(
        Type.Number({ description: "Estimated duration in minutes" })
      ),
    }),
    { minItems: 1, description: "Ordered list of steps to complete the task" }
  ),
});

export type TaskPlanParams = {
  title: string;
  steps: Array<{ index: number; description: string; estimatedMinutes?: number }>;
};

export async function executeTaskPlan(_id: string, params: TaskPlanParams) {
  const task = createTask(params.title, params.steps);
  await saveTask(task);

  const stepList = params.steps
    .map((s) => {
      const eta = s.estimatedMinutes ? ` (${formatDuration(s.estimatedMinutes)})` : "";
      return `  ${s.index}. ${s.description}${eta}`;
    })
    .join("\n");

  const bar = buildProgressBar(0, params.steps.length);

  const message = [
    `**${params.title}**`,
    `Task ID: \`${task.taskId}\``,
    ``,
    `Plan — ${params.steps.length} step${params.steps.length > 1 ? "s" : ""}:`,
    stepList,
    ``,
    `${bar}`,
    `Starting now...`,
  ].join("\n");

  return { content: [{ type: "text" as const, text: message }] };
}
