---
name: claw-doing
description: "Enables real-time progress tracking for long-running tasks in OpenClaw. Use when starting any complex task with 3+ steps, when the user asks for a progress update during long work, or when you are about to do multi-step research, file generation, or sub-agent coordination. Requires the claw-doing plugin: openclaw plugins install claw-doing"
---

# Claw Doing — Task Progress Tracking

This skill teaches you to use the **claw-doing** plugin to keep users informed during any long or complex task. Instead of going silent while you work, you report progress after every step — directly in the user's chat channel.

## Prerequisites

The `claw-doing` plugin must be installed on the user's OpenClaw gateway:

```bash
openclaw plugins install claw-doing
```

After installation, restart the gateway. The plugin registers three tools: `task_plan`, `task_step_done`, and `task_complete`.

## When to use this skill

Use progress tracking whenever the task you are about to perform:

- Has **3 or more distinct steps**
- Will take **more than ~2 minutes**
- Involves web research, file generation, data processing, or spawning sub-agents
- Is the kind of task where the user might wonder "is it still running?"

If in doubt, use it. It costs nothing and significantly improves the user experience.

## Workflow

### Step 1 — Declare the plan (before you do anything else)

The very first thing you do, before executing any step, is call `task_plan`. This registers the task and shows the user what to expect.

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

The tool returns a formatted plan and a **task ID**. Send the tool output to the user immediately — do not paraphrase or delay it.

Save the task ID: you need it for every subsequent call.

### Step 2 — Report after each step

Immediately after completing a step (before starting the next one), call `task_step_done`:

```
task_step_done({
  taskId: "<taskId from task_plan>",
  stepIndex: 1,
  summary: "Found 47 sources, filtered to 14 high-quality references",
  deviation: "Two sources were paywalled — used abstracts only"
})
```

The `deviation` field is optional. Use it when something unexpected happened — a source was unavailable, a result was ambiguous, you made a judgment call. This keeps the user informed about decisions you made on their behalf.

Send the tool output to the user immediately.

### Step 3 — Close the task when finished

When the entire task is complete — or if it has definitively failed — call `task_complete`:

```
task_complete({
  taskId: "<taskId>",
  outcome: "success",
  summary: "Compiled a 2,800-word report covering 8 frameworks with 12 citations. Key finding: LangGraph leads on orchestration; OpenClaw leads on channel integrations.",
  artifacts: ["memory/2026-03-29-ai-agent-frameworks.md"]
})
```

Always call `task_complete`, even on failure — it closes the task record cleanly.

Send the tool output to the user. This is the user's final delivery notification.

## Outcome values

| Value | When to use |
|-------|-------------|
| `success` | All steps completed, output matches the user's intent |
| `partial` | Some steps had issues, but you produced useful output |
| `failed` | The task could not be completed |

## Rules

- Call `task_plan` **before** executing anything — never retroactively.
- Call `task_complete` **always** — even when the task fails.
- Relay tool output to the user **immediately** after each call.
- Keep `summary` fields **factual and brief** — 1 to 2 sentences.
- Use `deviation` **honestly** — it builds user trust.
- Never skip `task_step_done` for a completed step, even if you are in a hurry.

## Full example

```
User: "Scrape the top 20 Hacker News posts this week and summarize them"

You call:
  task_plan({
    title: "Summarize top 20 HN posts",
    steps: [
      { index: 1, description: "Fetch HN front page and extract post URLs", estimatedMinutes: 1 },
      { index: 2, description: "Scrape content from each post", estimatedMinutes: 4 },
      { index: 3, description: "Generate per-post summaries", estimatedMinutes: 3 },
      { index: 4, description: "Compile and deliver digest", estimatedMinutes: 2 }
    ]
  })
→ relay output to user

(execute step 1)

  task_step_done({ taskId, stepIndex: 1, summary: "Fetched 20 post URLs from HN front page" })
→ relay output to user

(execute step 2)

  task_step_done({
    taskId,
    stepIndex: 2,
    summary: "Scraped 18 of 20 posts",
    deviation: "2 posts linked to PDFs — skipped, will note in digest"
  })
→ relay output to user

(execute steps 3–4 similarly)

  task_complete({
    taskId,
    outcome: "partial",
    summary: "Digest covers 18 of 20 posts. Two PDF links were skipped and noted.",
    artifacts: ["memory/2026-03-29-hn-digest.md"]
  })
→ relay output to user
```

## What the user sees

```
[░░░░░░░░░░] 0/4 — Starting now...

[███░░░░░░░] 1/4 — elapsed: 1m 2s
✓ Step 1: Fetched 20 post URLs from HN front page

[██████░░░░] 2/4 — elapsed: 5m 14s
✓ Step 2: Scraped 18 of 20 posts
⚠ Note: 2 posts linked to PDFs — skipped, will note in digest

...

[██████████] 4/4 — 10m 33s total
⚠️ Partially completed

Digest covers 18 of 20 posts. Two PDF links were skipped and noted.

Deliverables:
  • memory/2026-03-29-hn-digest.md
```

## FAQ

**What if the task only has 2 steps?**
Skip the tracking tools — they add overhead without much benefit for very short tasks. Use your judgment: if the user will wait more than 2 minutes, use tracking.

**What if a step fails mid-task?**
Call `task_step_done` with `deviation` explaining what went wrong, then decide whether to continue, adapt, or call `task_complete` with `outcome: "failed"`.

**What if I don't know the number of steps upfront?**
Estimate. A rough plan with approximate steps is much better than no plan. You can add a note in `summary` at completion if the actual steps differed.

**Where is the task data stored?**
In `~/.openclaw/workspace/claw-doing/tasks/<taskId>.json`. Each task is a JSON file the user can inspect or archive.
