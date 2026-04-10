export function formatDate(timestamp: string | null): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
