import type { RunRow } from "../db/queries.js";

export function fmtTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function fmtTimeShort(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(5, 19);
}

export function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

export function fmtTokens(row: RunRow): string {
  if (!row.total_tokens) return "—";
  return row.total_tokens.toLocaleString();
}

export function fmtTokensFull(row: RunRow): string {
  if (!row.total_tokens) return "—";
  const parts = [`${row.total_tokens.toLocaleString()} total`];
  if (row.input_tokens) parts.push(`${row.input_tokens.toLocaleString()} in`);
  if (row.output_tokens) parts.push(`${row.output_tokens.toLocaleString()} out`);
  if (row.cache_read_tokens) parts.push(`${row.cache_read_tokens.toLocaleString()} cached`);
  return parts.join(" · ");
}

export function statusIcon(status: string): string {
  if (status === "success") return "✓";
  if (status === "error") return "✗";
  return "…";
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function fmtRelativeTime(ms: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 14) return `${days}d ago`;
  return fmtTimeShort(ms);
}

export function fmtJson(json: string | null | undefined, max = 200): string {
  if (!json || json === "null") return "(none)";
  try {
    const parsed = JSON.parse(json);
    const pretty = JSON.stringify(parsed, null, 2);
    return truncate(pretty, max);
  } catch {
    return truncate(json, max);
  }
}
