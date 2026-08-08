import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "@/features/merchant/constants/registration/defaultValues.constants";
import {
  NormalizedOperatingHours,
  normalizeOperatingHours,
} from "../normalizers/normalizeOperatingHours.utils";

/**
 * The normalized default operating hours used when a merchant
 * starts a brand-new registration.
 */
const DEFAULT_OPERATING_HOURS = normalizeOperatingHours(
  MERCHANT_REGISTRATION_DEFAULT_VALUES,
);

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
 * Determines whether the operating hours are still in their
 * default, untouched state.
 */
function isOperatingHoursDefault(hours: NormalizedOperatingHours): boolean {
  return areOperatingHoursEqual(hours.hours, DEFAULT_OPERATING_HOURS.hours);
}

export function hasUnsavedOperatingHoursChanges(
  previous: NormalizedOperatingHours | null,
  current: NormalizedOperatingHours,
) {
  if (previous === null) {
    return !isOperatingHoursDefault(current);
  }

  return shouldSaveOperatingHours(previous, current);
}

/**
 * Determines whether the operating hours should be sent
 * to the backend.
 *
 * This differs from unsaved-change detection:
 * - If no previous save exists, always save so the backend
 *   receives the initial operating hours (even if they match
 *   the default values).
 * - Otherwise, save only when the current operating hours
 *   differ from the last successfully saved version.
 */
export function shouldSaveOperatingHours(
  previous: NormalizedOperatingHours | null,
  current: NormalizedOperatingHours,
): boolean {
  if (previous === null) {
    return true;
  }

  return !areOperatingHoursEqual(previous.hours, current.hours);
}
