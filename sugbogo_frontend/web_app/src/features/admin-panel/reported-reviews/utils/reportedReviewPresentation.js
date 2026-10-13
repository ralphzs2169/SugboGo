export const REPORT_REASONS = {
  spam: "Spam",
  abuse: "Abuse or Harassment",
  misinformation: "False or Misleading Information",
  off_topic: "Off-topic or Irrelevant",
  private_information: "Personal or Private Information",
  other: "Other",
};

export function displayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unknown author";
}

export function pendingReasons(reasonCounts = {}) {
  return Object.entries(REPORT_REASONS).filter(
    ([reason]) => (reasonCounts[reason] ?? 0) > 0,
  );
}

export function formatReportedQueueTime(value, now = Date.now()) {
  if (!value) {
    return "Reported date unavailable";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60000),
  );

  if (elapsedMinutes < 1) {
    return "Reported just now";
  }

  if (elapsedMinutes < 60) {
    return `Reported ${elapsedMinutes}m ago`;
  }

  if (elapsedMinutes < 1440) {
    return `Reported ${Math.floor(elapsedMinutes / 60)}h ago`;
  }

  return `Reported ${Math.floor(elapsedMinutes / 1440)}d ago`;
}

export function nextReportedSelection(previousItems, refreshedItems, selectedId) {
  if (refreshedItems.some((item) => item.id === selectedId)) {
    return selectedId;
  }

  const previousIndex = previousItems.findIndex((item) => item.id === selectedId);
  if (previousIndex < 0 || refreshedItems.length === 0) {
    return null;
  }

  return refreshedItems[Math.min(previousIndex, refreshedItems.length - 1)].id;
}
