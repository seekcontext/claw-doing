import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { TaskPlanSchema, executeTaskPlan, type TaskPlanParams } from "./src/tools/task-plan.js";
import {
  TaskStepDoneSchema,
  executeTaskStepDone,
  type TaskStepDoneParams,
} from "./src/tools/task-step-done.js";
import {
  TaskCompleteSchema,
  executeTaskComplete,
  type TaskCompleteParams,
} from "./src/tools/task-complete.js";

export default definePluginEntry({
  id: "claw-doing",
  name: "Claw Doing",
  description:
    "Real-time progress tracking for long-running agent tasks. See what your agent is doing — right now.",

  register(api) {
    api.registerTool({
      name: "task_plan",
      description:
        "Call this at the START of any complex task that has 3 or more distinct steps. " +
        "Declares the task plan to the user and returns a task ID needed for subsequent progress calls. " +
        "Always call task_step_done after completing each step, and task_complete when finished.",
      parameters: TaskPlanSchema,
      async execute(_id, params) {
        return executeTaskPlan(_id, params as TaskPlanParams);
      },
    });

    api.registerTool({
      name: "task_step_done",
      description:
        "Call this immediately after completing each step of a task registered with task_plan. " +
        "Reports progress to the user with a visual progress bar and step summary. " +
        "Include a deviation note if the step produced unexpected results.",
      parameters: TaskStepDoneSchema,
      async execute(_id, params) {
        return executeTaskStepDone(_id, params as TaskStepDoneParams);
      },
    });

    api.registerTool({
      name: "task_complete",
      description:
        "Call this when a task registered with task_plan has finished (success, partial, or failed). " +
        "Delivers the final summary and list of produced artifacts to the user. " +
        "Always call this even if the task failed — it closes the task record.",
      parameters: TaskCompleteSchema,
      async execute(_id, params) {
        return executeTaskComplete(_id, params as TaskCompleteParams);
      },
    });
  },
});
