import type { ExploreOperatingHours } from "../types/exploreBusiness.types";

type BusinessHoursSummary = {
  status: "open" | "closed" | "unavailable";
  closingTime?: string;
  openingTime?: string;
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

type OperatingHours = Pick<
  ExploreOperatingHours,
  "day" | "is_open" | "is_24_hours" | "open_time" | "close_time"
>;

const DAY_MS = 24 * 60 * 60_000;

const businessClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getBusinessClock(now: Date) {
  const parts = Object.fromEntries(
    businessClock.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return {
    day: parts.weekday.toLowerCase(),
    time:
      Number(parts.hour) * 60 * 60_000 +
      Number(parts.minute) * 60_000 +
      Number(parts.second) * 1000 +
      now.getUTCMilliseconds(),
  };
}

/** Returns the schedule day in the business's Philippine timezone. */
export function getBusinessDay(now = new Date()): string {
  return getBusinessClock(now).day;
}

function timeToMilliseconds(time: string | null): number | null {
  if (!time) return null;
  const match = time.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?$/,
  );
  if (!match) return null;
  return (
    Number(match[1]) * 60 * 60_000 +
    Number(match[2]) * 60_000 +
    Number(match[3] ?? 0) * 1000 +
    Number(`0.${match[4] ?? 0}`) * 1000
  );
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function formatCompactTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  if (minutes === 0) return `${displayHour} ${period}`;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getDayHours(
  operatingHours: readonly OperatingHours[],
  dayIndex: number,
) {
  return operatingHours.find(
    (hours) => hours.day.toLowerCase() === DAY_ORDER[dayIndex],
  );
}

function getShift(hours: OperatingHours | undefined) {
  if (!hours?.is_open || hours.is_24_hours) return null;
  const open = timeToMilliseconds(hours.open_time);
  const close = timeToMilliseconds(hours.close_time);
  if (open === null || close === null) return null;
  return { open, close };
}

/** Matches the backend's Manila-time intervals, including previous-day spillover. */
export function getBusinessHoursSummary(
  operatingHours: readonly OperatingHours[],
  now = new Date(),
): BusinessHoursSummary {
  const clock = getBusinessClock(now);
  const dayIndex = DAY_ORDER.indexOf(clock.day);
  const today = getDayHours(operatingHours, dayIndex);
  const yesterday = getDayHours(operatingHours, (dayIndex + 6) % 7);
  const shift = getShift(today);
  const previousShift = getShift(yesterday);
  if (today?.is_open && today.is_24_hours) {
    return { label: "Open 24 hours", isOpen: true, status: "open" };
  }
  let closingTime: string | undefined;
  let closesAt = -1;
  if (
    previousShift &&
    previousShift.open > previousShift.close &&
    clock.time < previousShift.close
  ) {
    closingTime = yesterday!.close_time!;
    closesAt = previousShift.close;
  }
  if (
    shift &&
    clock.time >= shift.open &&
    (shift.open > shift.close || clock.time < shift.close)
  ) {
    const end = shift.close + (shift.open > shift.close ? DAY_MS : 0);
    if (end > closesAt) {
      closingTime = today!.close_time!;
    }
  }
  if (closingTime) {
    return {
      label: `Open now · Closes ${formatTime(closingTime)}`,
      isOpen: true,
      status: "open",
      closingTime,
    };
  }
  if (!today || (today.is_open && !shift)) {
    return { label: "Hours unavailable", isOpen: false, status: "unavailable" };
  }
  if (shift && shift.open !== shift.close && clock.time < shift.open) {
    return {
      label: `Closed · Opens today at ${formatTime(today!.open_time!)}`,
      isOpen: false,
      status: "closed",
      openingTime: today!.open_time!,
    };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = getDayHours(operatingHours, (dayIndex + offset) % 7);
    if (!next?.is_open) continue;
    const nextShift = getShift(next);
    if (
      !next.is_24_hours &&
      (!nextShift || nextShift.open === nextShift.close)
    ) {
      continue;
    }
    const day = offset === 1 ? "tomorrow" : DAY_LABELS[next.day.toLowerCase()];
    return {
      label: next.is_24_hours
        ? `Closed · Opens ${day}`
        : `Closed · Opens ${day} at ${formatTime(next.open_time!)}`,
      isOpen: false,
      status: "closed",
      openingTime: next.is_24_hours ? undefined : next.open_time!,
    };
  }
  return { label: "Closed", isOpen: false, status: "closed" };
}

/** Wakes only at a possible status change or Philippine midnight for day labels. */
export function getNextBusinessHoursUpdate(
  operatingHours: readonly OperatingHours[],
  now = new Date(),
): number {
  const clock = getBusinessClock(now);
  const dayIndex = DAY_ORDER.indexOf(clock.day);
  const today = getShift(getDayHours(operatingHours, dayIndex));
  const yesterday = getShift(getDayHours(operatingHours, (dayIndex + 6) % 7));
  const boundaries = [DAY_MS];
  if (today && today.open !== today.close) {
    boundaries.push(today.open);
    if (today.open < today.close) {
      boundaries.push(today.close);
    }
  }
  if (yesterday && yesterday.open > yesterday.close) {
    boundaries.push(yesterday.close);
  }
  const next = Math.min(
    ...boundaries.filter((boundary) => boundary > clock.time),
  );
  return now.getTime() + Math.ceil(next - clock.time);
}

/** Supplies precise quick-info labels without parsing presentation text. */
export function getQuickInfoStatus(summary: BusinessHoursSummary) {
  if (summary.status === "unavailable") {
    return {
      statusLabel: "Hours unavailable",
      statusDetail: "",
      isOpen: null,
    };
  }
  if (summary.isOpen) {
    return {
      statusLabel: "Open",
      statusDetail: summary.closingTime
        ? `Closes ${formatCompactTime(summary.closingTime)}`
        : "24 hours",
      isOpen: true,
    };
  }
  return {
    statusLabel: "Closed",
    statusDetail: summary.openingTime
      ? `Opens ${formatCompactTime(summary.openingTime)}`
      : summary.label.replace("Closed · ", ""),
    isOpen: false,
  };
}
