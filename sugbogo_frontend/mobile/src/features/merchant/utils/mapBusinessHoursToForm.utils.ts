import { DAYS } from "../constants/operatingHours.constants";
import type { MerchantBusinessOperatingHours } from "../types/merchantBusinessProfile.types";
import type { OperatingHours } from "../validation/operatingHours.schema";

/** Convert approved API hours into the focused seven-day editing shape. */
export function mapBusinessHoursToForm(
  approvedHours: MerchantBusinessOperatingHours[],
): OperatingHours {
  const hours = {} as OperatingHours;

  for (const day of DAYS) {
    const approved = approvedHours.find((item) => item.day === day);

    hours[day] = {
      isOpen: approved?.is_open ?? false,
      is24Hours: approved?.is_24_hours ?? false,
      openTime: approved?.open_time?.slice(0, 5) ?? "",
      closeTime: approved?.close_time?.slice(0, 5) ?? "",
    };
  }

  return hours;
}
