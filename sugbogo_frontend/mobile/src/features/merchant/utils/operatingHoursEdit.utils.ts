import { DAYS, type Day } from "../constants/operatingHours.constants";
import type { MerchantBusinessOperatingHours } from "../types/merchantBusinessProfile.types";
import type {
  OperatingHours,
  OperatingHoursDay,
} from "../validation/operatingHours.schema";

/** Ignores time fields that do not apply to closed or 24-hour days. */
export function sameOperatingDay(
  first: OperatingHoursDay,
  second: OperatingHoursDay,
) {
  return (
    first.isOpen === second.isOpen &&
    (!first.isOpen ||
      (first.is24Hours === second.is24Hours &&
        (first.is24Hours ||
          (first.openTime === second.openTime &&
            first.closeTime === second.closeTime))))
  );
}

/** Identifies only days the merchant meaningfully changed from the captured week. */
export function editedOperatingDays(
  baseline: OperatingHours,
  draft: OperatingHours,
): Day[] {
  return DAYS.filter((day) => !sameOperatingDay(baseline[day], draft[day]));
}

/** Compares server snapshots independently of ordering and HH:mm/HH:mm:ss formatting. */
export function operatingHoursSnapshotKey(
  hours: MerchantBusinessOperatingHours[],
) {
  return JSON.stringify(
    [...hours]
      .sort((first, second) => first.day.localeCompare(second.day))
      .map((schedule) => ({
        day: schedule.day,
        is_open: schedule.is_open,
        is_24_hours: schedule.is_open && schedule.is_24_hours,
        open_time:
          schedule.is_open && !schedule.is_24_hours
            ? normalizeTime(schedule.open_time)
            : null,
        close_time:
          schedule.is_open && !schedule.is_24_hours
            ? normalizeTime(schedule.close_time)
            : null,
      })),
  );
}

/** Keeps second precision in the concurrency baseline while normalizing minute strings. */
function normalizeTime(value: string | null) {
  return value?.length === 5 ? `${value}:00` : value;
}
