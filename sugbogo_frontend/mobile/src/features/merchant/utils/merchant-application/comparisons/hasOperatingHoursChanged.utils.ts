import { NormalizedOperatingHours } from "../normalizers/normalizeOperatingHours.utils";

/**
 * Compares two operating-hours arrays.
 */
function areOperatingHoursEqual(
  a: NormalizedOperatingHours["hours"],
  b: NormalizedOperatingHours["hours"],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((day, index) => {
    const other = b[index];

    return (
      day.day === other.day &&
      day.isOpen === other.isOpen &&
      day.is24Hours === other.is24Hours &&
      day.openTime === other.openTime &&
      day.closeTime === other.closeTime
    );
  });
}

/**
 * Determines whether the operating-hours payload has changed
 * since the last successful save.
 */
export function hasOperatingHoursChanged(
  previous: NormalizedOperatingHours | null,
  current: NormalizedOperatingHours,
): boolean {
  // Nothing has ever been saved, so we must save.
  if (previous === null) {
    return true;
  }

  return !areOperatingHoursEqual(previous.hours, current.hours);
}
