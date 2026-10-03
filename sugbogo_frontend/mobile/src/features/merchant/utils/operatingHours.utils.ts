import { DAYS } from "../constants/operatingHours.constants";
import type { OperatingHours } from "../validation/operatingHours.schema";

export type OperatingHoursPayload = {
  hours: {
    day: (typeof DAYS)[number];
    is_open: boolean;
    is_24_hours: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
};

export function buildHoursPayload(
  hours: OperatingHours,
): OperatingHoursPayload {
  return {
    hours: DAYS.map((day) => {
      const schedule = hours[day];

      return {
        day,
        is_open: schedule.isOpen,
        is_24_hours: schedule.is24Hours,
        open_time: schedule.openTime || null,
        close_time: schedule.closeTime || null,
      };
    }),
  };
}

export function timeStringToDate(time: string) {
  const date = new Date();

  if (!time) {
    date.setHours(8, 0, 0, 0);
    return date;
  }

  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToTimeString(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTime(time: string) {
  if (!time) {
    return "Select time";
  }

  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
