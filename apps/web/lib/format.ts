/** Formatting for machine-produced values. Always paired with `font-mono`. */

export function duration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * Relative time against a fixed clock. Takes `now` explicitly so server and
 * client render the same string — a live `Date.now()` here would hydrate
 * mismatched.
 */
export function since(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function pct(used: number, limit: number): number {
  return Math.min(100, Math.round((used / limit) * 100));
}

export function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
