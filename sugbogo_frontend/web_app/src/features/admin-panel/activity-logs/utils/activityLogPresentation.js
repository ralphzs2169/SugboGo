import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_MODULES,
} from "../constants/activityLogOptions";

/** Format recorded codes without substituting current profile information. */
export function activityLabel(value) {
  if (typeof value !== "string" || !value.trim()) return "Not recorded";
  const option = [...ACTIVITY_ACTIONS, ...ACTIVITY_MODULES].find(
    (item) => item.value === value,
  );
  const category = ACTIVITY_CATEGORIES.find((item) => item.id === value);
  return option?.label ?? category?.label ??
    value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

/** Identify an actor from its stored display snapshot or stable user reference only. */
export function activityActor(event) {
  return event.actor_display_snapshot ||
    (event.actor_id != null ? `User #${event.actor_id}` : "Not recorded");
}

/** Prefer a retained label while keeping the actual affected entity identifiable. */
export function activityTarget(event) {
  if (event.target_label) return event.target_label;
  if (event.target_type && event.target_id != null) {
    return `${activityLabel(event.target_type)} #${event.target_id}`;
  }
  return "Not recorded";
}

/** Retain the original timestamp while displaying calendar and clock values in Philippine time. */
export function activityDateParts(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    original: value,
    date: new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date),
  };
}

/** Render allowlisted primitive detail values without stringifying unknown or nested JSON. */
export function activityDetailEntries(
  value,
  labels,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(labels).flatMap(([key, label]) => {
    const item = value[key];
    const scalar = (child) => (
      typeof child === "boolean" ||
      (typeof child === "number" && Number.isFinite(child)) ||
      (typeof child === "string" && child.length <= 2000)
    );
    if (scalar(item)) return [[label, String(item)]];
    if (Array.isArray(item) && item.length <= 100 && item.every(scalar)) {
      return [[label, item.length ? item.map(String).join(", ") : "None recorded"]];
    }
    return [];
  });
}
