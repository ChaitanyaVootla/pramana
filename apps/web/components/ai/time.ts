/** "just now", "4 minutes ago", "3 hours ago", else "18 Oct" (or "18 Oct 2025" in another year). */
export function whenPosted(value: Date | string, now = Date.now()): string {
  const at = new Date(value);
  const s = Math.max(0, (now - at.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const sameYear = at.getFullYear() === new Date(now).getFullYear();
  return at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
