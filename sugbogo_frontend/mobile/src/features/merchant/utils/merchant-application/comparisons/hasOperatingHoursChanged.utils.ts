import { ApplicationOperatingHoursPayload } from "../../../types/registration/registrationApi.types";

/**
 * Compares two operating-hours arrays.
 */
function areOperatingHoursEqual(
  a: ApplicationOperatingHoursPayload["hours"],
  b: ApplicationOperatingHoursPayload["hours"],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((day, index) => {
    const other = b[index];

    return (
      day.day === other.day &&
      day.is_open === other.is_open &&
      day.is_24_hours === other.is_24_hours &&
      day.open_time === other.open_time &&
      day.close_time === other.close_time
    );
  });
}

/**
 * Determines whether the operating-hours payload has changed
 * since the last successful save.
 */
export function hasOperatingHoursChanged(
  previous: ApplicationOperatingHoursPayload | null,
  current: ApplicationOperatingHoursPayload,
): boolean {
  // Nothing has ever been saved, so we must save.
  if (previous === null) {
    return true;
  }

  return !areOperatingHoursEqual(previous.hours, current.hours);
}
