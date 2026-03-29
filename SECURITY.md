# Security Policy

## Summary of file system access

`claw-doing` writes task state to a single local directory. No network requests are made.

**Default storage path:**

```
~/.openclaw/workspace/claw-doing/tasks/<taskId>.json
```

Each file is a JSON record containing the task title, step descriptions, step summaries, and optional deviation notes. No credentials, tokens, environment variables (other than `CLAW_DOING_STORAGE_DIR`), or external network calls are used.

**Configuring the storage path:**

Set `CLAW_DOING_STORAGE_DIR` to any directory you prefer, or configure `storageDir` in `openclaw.config.json`. See the README for details.

## No network access

This plugin makes no HTTP requests or outbound connections of any kind. All I/O is local file system reads and writes within the configured storage directory.

## Reporting a vulnerability

If you discover a genuine security issue, please open a GitHub issue at [github.com/seekcontext/claw-doing/issues](https://github.com/seekcontext/claw-doing/issues) or contact the maintainer directly.
