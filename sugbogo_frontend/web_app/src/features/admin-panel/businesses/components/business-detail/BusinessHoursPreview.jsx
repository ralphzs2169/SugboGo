import { ChevronDown, Clock } from "lucide-react";
import { useState } from "react";

import {
  formatOperatingHours,
  isOvernightOperatingHours,
} from "../../../business-applications/utils/operatingHours.utils";

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_LABELS = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

/**
 * Displays the business's current operating status.
 *
 * Determines whether the business is actually open at the current time,
 * including normal, 24-hour, and overnight operating schedules. The full
 * weekly schedule can be expanded inline without leaving the business
 * detail page.
 */
export default function BusinessOperatingHoursPreview({ operatingHours = [] }) {
  const [isHoursOpen, setIsHoursOpen] = useState(false);

  if (!operatingHours.length) {
    return null;
  }

  const now = new Date();
  const currentDayIndex = now.getDay();

  const todayKey = DAY_ORDER[currentDayIndex];

  const yesterdayKey =
    DAY_ORDER[(currentDayIndex - 1 + DAY_ORDER.length) % DAY_ORDER.length];

  const todayHours = operatingHours.find((hours) => hours.day === todayKey);

  const yesterdayHours = operatingHours.find(
    (hours) => hours.day === yesterdayKey,
  );

  function formatTime(time) {
    if (!time) {
      return null;
    }

    const [hour, minute] = time.split(":");
    const date = new Date();

    date.setHours(Number(hour), Number(minute), 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getMinutes(time) {
    if (!time) {
      return null;
    }

    const [hour, minute] = time.split(":").map(Number);

    return hour * 60 + minute;
  }

  function isOvernight(hours) {
    if (!hours?.is_open || hours.is_24_hours) {
      return false;
    }

    const openMinutes = getMinutes(hours.open_time);
    const closeMinutes = getMinutes(hours.close_time);

    if (openMinutes === null || closeMinutes === null) {
      return false;
    }

    return closeMinutes < openMinutes;
  }

  function getCurrentMinutes() {
    return now.getHours() * 60 + now.getMinutes();
  }

  function getNextOpeningLabel() {
    for (let offset = 1; offset <= 7; offset += 1) {
      const nextDayIndex = (currentDayIndex + offset) % DAY_ORDER.length;
      const nextDayKey = DAY_ORDER[nextDayIndex];

      const nextHours = operatingHours.find(
        (hours) => hours.day === nextDayKey,
      );

      if (!nextHours?.is_open) {
        continue;
      }

      const dayLabel = offset === 1 ? "tomorrow" : DAY_LABELS[nextDayKey];

      if (nextHours.is_24_hours) {
        return `Opens ${dayLabel}`;
      }

      const openingTime = formatTime(nextHours.open_time);

      if (!openingTime) {
        continue;
      }

      return `Opens ${dayLabel} at ${openingTime}`;
    }

    return "No upcoming hours";
  }

  function getTodayStatus() {
    const currentMinutes = getCurrentMinutes();

    // Check whether yesterday's overnight schedule is still active.
    if (
      yesterdayHours?.is_open &&
      !yesterdayHours.is_24_hours &&
      isOvernight(yesterdayHours)
    ) {
      const yesterdayClose = getMinutes(yesterdayHours.close_time);

      if (yesterdayClose !== null && currentMinutes < yesterdayClose) {
        return {
          isOpen: true,
          label: `Closes ${formatTime(yesterdayHours.close_time)}`,
        };
      }
    }

    if (!todayHours) {
      return {
        isOpen: false,
        label: "Hours unavailable",
      };
    }

    if (!todayHours.is_open) {
      return {
        isOpen: false,
        label: getNextOpeningLabel(),
      };
    }

    if (todayHours.is_24_hours) {
      return {
        isOpen: true,
        label: "Open 24 hours",
      };
    }

    const openMinutes = getMinutes(todayHours.open_time);
    const closeMinutes = getMinutes(todayHours.close_time);

    if (openMinutes === null || closeMinutes === null) {
      return {
        isOpen: false,
        label: "Hours unavailable",
      };
    }

    const overnight = isOvernight(todayHours);

    if (overnight) {
      const isCurrentlyOpen =
        currentMinutes >= openMinutes || currentMinutes < closeMinutes;

      if (isCurrentlyOpen) {
        return {
          isOpen: true,
          label:
            currentMinutes < closeMinutes
              ? `Closes ${formatTime(todayHours.close_time)}`
              : `Closes ${formatTime(todayHours.close_time)} tomorrow`,
        };
      }

      return {
        isOpen: false,
        label: getNextOpeningLabel(),
      };
    }

    if (currentMinutes < openMinutes) {
      return {
        isOpen: false,
        label: `Opens ${formatTime(todayHours.open_time)}`,
      };
    }

    if (currentMinutes >= closeMinutes) {
      return {
        isOpen: false,
        label: getNextOpeningLabel(),
      };
    }

    return {
      isOpen: true,
      label: `Closes ${formatTime(todayHours.close_time)}`,
    };
  }

  const todayStatus = getTodayStatus();

  return (
    <div className="border-t border-stroke pt-4">
      {/* Current operating status */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Clock
            size={16}
            strokeWidth={1.8}
            className="shrink-0 text-text-secondary"
          />

          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-medium ${
                todayStatus.isOpen ? "text-success" : "text-text-secondary"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  todayStatus.isOpen ? "bg-success" : "bg-text-secondary"
                }`}
              />

              {todayStatus.isOpen ? "Open" : "Closed"}
            </span>

            <span className="text-sm text-text-secondary">·</span>

            <p className="truncate text-sm text-text-secondary">
              {todayStatus.label}
            </p>
          </div>
        </div>

        {/* Schedule toggle */}
        <button
          type="button"
          onClick={() => setIsHoursOpen((previous) => !previous)}
          className="flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          aria-expanded={isHoursOpen}
        >
          {isHoursOpen ? "Hide hours" : "View all hours"}

          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`transition-transform duration-200 ${
              isHoursOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Expanded weekly schedule */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          isHoursOpen
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="divide-y divide-stroke rounded-lg border border-stroke">
            {DAY_ORDER.map((day) => {
              const schedule = operatingHours.find(
                (hours) => hours.day === day,
              );

              const isToday = day === todayKey;
              const isOpen = schedule?.is_open ?? false;
              const overnight = isOvernightOperatingHours(schedule);

              return (
                <div
                  key={day}
                  className={`flex items-start justify-between gap-4 px-4 py-3 ${
                    isToday ? "bg-surface-muted" : ""
                  }`}
                >
                  {/* Day and schedule */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm ${
                          isToday
                            ? "font-semibold text-text-primary"
                            : "font-medium text-text-primary"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </p>

                      {isToday && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Today
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-text-secondary">
                      {!schedule || !isOpen
                        ? "Closed"
                        : schedule.is_24_hours
                          ? "Open 24 hours"
                          : formatOperatingHours(schedule)}
                    </p>

                    {isOpen && overnight && (
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        Overnight · closes the following day
                      </p>
                    )}
                  </div>

                  {/* Open/closed status */}
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium ${
                      isOpen ? "text-success" : "text-text-secondary"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isOpen ? "bg-success" : "bg-text-secondary"
                      }`}
                    />

                    {isOpen ? "Open" : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
