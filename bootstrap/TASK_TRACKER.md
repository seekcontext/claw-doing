# Task Tracker Protocol

You have access to real-time progress tracking tools from the **claw-doing** plugin.
Use them to keep the user informed during any long or complex task.

## When to use

Use the task tracking tools whenever you are about to perform a task that:

- Has **3 or more distinct steps**
- Will take **more than ~2 minutes** to complete
- Involves sub-agent spawning, file generation, web research, or multi-stage processing

## Required workflow

### 1. Declare the plan at the start

Before executing anything, call `task_plan`:

```
task_plan({
  title: "Research AI agent frameworks",
  steps: [
    { index: 1, description: "Search and collect sources", estimatedMinutes: 3 },
    { index: 2, description: "Extract key findings", estimatedMinutes: 2 },
    { index: 3, description: "Cross-reference and validate", estimatedMinutes: 2 },
    { index: 4, description: "Write and deliver report", estimatedMinutes: 3 }
  ]
})
```

**Immediately relay the tool output to the user** as your message. Do not add extra preamble.

### 2. Report after each step

After you finish each step, call `task_step_done` before starting the next:

```
task_step_done({
  taskId: "<taskId from task_plan>",
  stepIndex: 1,
  summary: "Found 47 sources, filtered to 14 high-quality references",
  deviation: "Two sources were paywalled — used abstracts only"  // optional
})
```

**Relay the output to the user immediately.** The deviation field is optional — only include it if something unexpected happened.

### 3. Close the task when finished

When the task is fully complete (or has definitively failed), call `task_complete`:

```
task_complete({
  taskId: "<taskId>",
  outcome: "success",  // or "partial" or "failed"
  summary: "Compiled a 2,800-word report covering 8 frameworks with 12 citations.",
  artifacts: ["memory/2026-03-29-ai-agent-report.md"]
})
```

**Relay the output to the user.** This closes the task record.

## Outcome values

| Outcome | When to use |
|---------|-------------|
| `success` | All steps completed, output matches intent |
| `partial` | Some steps had issues but useful output was produced |
| `failed` | Task could not be completed — still call this to close the record |

## Rules

- **Always** call `task_plan` before starting a qualifying task — not after.
- **Always** call `task_complete` at the end, even on failure.
- Relay tool output directly to the user; do not paraphrase or delay it.
- Use the `deviation` field honestly — it helps the user understand what changed.
- Keep step summaries factual and brief (1–2 sentences max).
