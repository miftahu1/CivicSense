export function formatDate(value: string, includeTime = false, language: "en" | "as" = "en") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat(language === "as" ? "as-IN" : "en-IN", includeTime ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function timeAgo(value: string, language: "en" | "as" = "en") {
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).valueOf()) / 3_600_000));
  if (hours < 1) return language === "as" ? "এইমাত্ৰ" : "Just now";
  if (hours < 24) return language === "as" ? `${new Intl.NumberFormat("as-IN").format(hours)} ঘণ্টা আগতে` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (language === "as") return days === 1 ? "কালি" : `${new Intl.NumberFormat("as-IN").format(days)} দিন আগতে`;
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export function statusClass(status: string) {
  if (status === "Investigating") return "status-investigating";
  if (status === "In progress") return "status-progress";
  if (status === "Resolved") return "status-resolved";
  return "status-review";
}

export function priorityClass(priority: string) {
  return `priority-${priority.toLowerCase()}`;
}
