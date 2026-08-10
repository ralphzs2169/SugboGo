/**
 * Formats an application timestamp for display in the review interface.
 */
export function formatApplicationDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Formats the elapsed time between two timestamps using a human-readable
 * relative duration.
 */
export function formatApplicationElapsedTime(startAt, endAt) {
  if (!startAt || !endAt) return null;

  const elapsedMilliseconds =
    new Date(endAt).getTime() - new Date(startAt).getTime();

  const elapsedMinutes = Math.floor(elapsedMilliseconds / (1000 * 60));

  const elapsedHours = Math.floor(elapsedMilliseconds / (1000 * 60 * 60));

  const elapsedDays = Math.floor(elapsedMilliseconds / (1000 * 60 * 60 * 24));

  if (elapsedMinutes < 1) return "Just now";

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"}`;
  }

  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"}`;
  }

  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"}`;
}

/**
 * Calculates the time an application has spent waiting for review.
 */
export function getApplicationTimeInQueue(submittedAt) {
  if (!submittedAt) return null;

  return formatApplicationElapsedTime(submittedAt, Date.now());
}

/**
 * Determines whether an application has received a final review decision.
 */
export function isApplicationResolved(status) {
  return status === "approved" || status === "rejected";
}
