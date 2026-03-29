const FILLED = "█";
const EMPTY = "░";

export function buildProgressBar(current: number, total: number, width = 10): string {
  if (total === 0) return `[${EMPTY.repeat(width)}] 0/0`;
  const filledCount = Math.min(Math.round((current / total) * width), width);
  const emptyCount = width - filledCount;
  return `[${FILLED.repeat(filledCount)}${EMPTY.repeat(emptyCount)}] ${current}/${total}`;
}

export function formatOutcome(outcome: "success" | "partial" | "failed"): string {
  const icons: Record<typeof outcome, string> = {
    success: "✅",
    partial: "⚠️",
    failed: "❌",
  };
  const labels: Record<typeof outcome, string> = {
    success: "Completed successfully",
    partial: "Partially completed",
    failed: "Failed",
  };
  return `${icons[outcome]} ${labels[outcome]}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

export function formatElapsed(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
