export interface TaskStep {
  index: number;
  description: string;
  estimatedMinutes?: number;
  status: "pending" | "done" | "failed";
  summary?: string;
  deviation?: string;
  completedAt?: string;
}

export interface Task {
  taskId: string;
  title: string;
  steps: TaskStep[];
  totalSteps: number;
  completedSteps: number;
  status: "running" | "done" | "partial" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  outcome?: "success" | "partial" | "failed";
  finalSummary?: string;
  artifacts?: string[];
}

export interface PluginConfig {
  storageDir?: string;
  progressBarWidth?: number;
}
