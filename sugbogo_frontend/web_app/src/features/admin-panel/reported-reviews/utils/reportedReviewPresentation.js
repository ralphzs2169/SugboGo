export const REPORT_REASONS = {
  spam: "Spam",
  abuse: "Abuse",
  misinformation: "Misinformation",
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
