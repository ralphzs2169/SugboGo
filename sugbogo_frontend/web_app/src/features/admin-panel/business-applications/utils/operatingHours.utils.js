/**
 * Formats a time value into a human-readable 12-hour time.
 */
export function formatOperatingHoursTime(time) {
  if (!time) return "—";

  const [hours, minutes] = time.split(":");
  const hour = Number(hours);

  if (Number.isNaN(hour)) {
    return "—";
  }

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${period}`;
}

/**
 * Formats a submitted operating schedule for administrative display.
 *
 * Handles closed, 24-hour, and regular operating schedules.
 */
export function formatOperatingHours(schedule) {
  if (!schedule.is_open) {
    return "—";
  }

  if (schedule.is_24_hours) {
    return "Open 24 hours";
  }

  return `${formatOperatingHoursTime(schedule.open_time)} – ${formatOperatingHoursTime(
    schedule.close_time,
  )}`;
}

/**
 * Determines whether an operating schedule continues into the following day.
 */
export function isOvernightOperatingHours(schedule) {
  return (
    schedule.is_open &&
    !schedule.is_24_hours &&
    Boolean(schedule.open_time) &&
    Boolean(schedule.close_time) &&
    schedule.close_time < schedule.open_time
  );
}
