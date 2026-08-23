import type { ExploreOperatingHours } from "../types/exploreBusiness.types";

type BusinessHoursSummary = {
  label: string;
  isOpen: boolean;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getCurrentDayIndex(date: Date): number {
  // JavaScript: Sunday = 0, Monday = 1, ..., Saturday = 6
  return (date.getDay() + 6) % 7;
}

function getDayHours(
  operatingHours: ExploreOperatingHours[],
  dayIndex: number,
): ExploreOperatingHours | undefined {
  const day = DAY_ORDER[dayIndex];

  return operatingHours.find((hours) => hours.day.toLowerCase() === day);
}

/**
 * Determines the most useful short-form operating-hours message for the
 * current moment.
 *
 * Handles open, closed, 24-hour, later-today, tomorrow, and next-open-day
 * states while keeping the UI component focused on presentation.
 */
export function getBusinessHoursSummary(
  operatingHours: ExploreOperatingHours[],
  now = new Date(),
): BusinessHoursSummary {
  if (operatingHours.length === 0) {
    return {
      label: "Hours unavailable",
      isOpen: false,
    };
  }

  const currentDayIndex = getCurrentDayIndex(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const today = getDayHours(operatingHours, currentDayIndex);

  if (today?.is_open) {
    if (today.is_24_hours) {
      return {
        label: "Open 24 hours",
        isOpen: true,
      };
    }

    if (today.open_time && today.close_time) {
      const openMinutes = timeToMinutes(today.open_time);
      const closeMinutes = timeToMinutes(today.close_time);

      if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
        return {
          label: `Open now · Closes ${formatTime(today.close_time)}`,
          isOpen: true,
        };
      }

      if (currentMinutes < openMinutes) {
        return {
          label: `Closed · Opens today at ${formatTime(today.open_time)}`,
          isOpen: false,
        };
      }
    }
  }

  // Find the next available opening day.
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDayIndex = (currentDayIndex + offset) % 7;

    const nextDay = getDayHours(operatingHours, nextDayIndex);

    if (nextDay?.is_open && (nextDay.is_24_hours || nextDay.open_time)) {
      if (nextDay.is_24_hours) {
        return {
          label: `Closed · Opens ${offset === 1 ? "tomorrow" : DAY_LABELS[nextDay.day.toLowerCase()]}`,
          isOpen: false,
        };
      }

      const openingTime = formatTime(nextDay.open_time!);

      if (offset === 1) {
        return {
          label: `Closed · Opens tomorrow at ${openingTime}`,
          isOpen: false,
        };
      }

      return {
        label: `Closed · Opens ${DAY_LABELS[nextDay.day.toLowerCase()]} at ${openingTime}`,
        isOpen: false,
      };
    }
  }

  return {
    label: "Closed",
    isOpen: false,
  };
}
