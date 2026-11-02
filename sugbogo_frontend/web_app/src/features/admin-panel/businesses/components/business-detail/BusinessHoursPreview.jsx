import { ChevronDown, Clock } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  getBusinessDay,
  getBusinessHoursSummary,
  getNextBusinessHoursUpdate,
} from "@/shared/utils/businessHours";
import {
  formatOperatingHours,
  isOvernightOperatingHours,
} from "../../../business-applications/utils/operatingHours.utils";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const EMPTY_HOURS = [];
const manilaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Reuse SugboGo's Manila-time intervals and keep the expandable schedule current at boundaries. */
export default function BusinessHoursPreview({ operatingHours = EMPTY_HOURS }) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const id = useId();
  useEffect(() => {
    let timer;
    function update() {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      const current = new Date();
      setNow(current);
      if (operatingHours.length) {
        timer = setTimeout(
          update,
          getNextBusinessHoursUpdate(operatingHours, current) -
            current.getTime(),
        );
      }
    }
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [operatingHours]);
  const summary = getBusinessHoursSummary(operatingHours, now);
  const today = getBusinessDay(now);
  let label = summary.label.replace("Open now", "Open");
  // This suffix explains the shared result; opening/closing eligibility stays in the shared utility.
  if (
    summary.isOpen &&
    summary.closingTime?.slice(0, 5) < manilaTime.format(now)
  ) {
    label += " tomorrow";
  }
  return (
    <div className="border-t border-stroke pt-4">
      {/* Live operating state */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className={
            "flex min-w-0 items-center gap-2 text-sm " +
            (summary.isOpen ? "text-success" : "text-text-secondary")
          }
        >
          <Clock size={16} aria-hidden="true" className="shrink-0" />
          <span>{label}</span>
        </p>
        {!!operatingHours.length && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((value) => !value)}
            className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-info"
          >
            {expanded ? "Hide hours" : "View all hours"}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={expanded ? "rotate-180" : ""}
            />
          </button>
        )}
      </div>
      {/* Weekly schedule in business time */}
      {expanded && (
        <div
          id={id}
          className="mt-4 divide-y divide-stroke rounded-lg border border-stroke"
        >
          <p className="px-4 py-2 text-xs text-text-secondary">
            Philippine time · Asia/Manila
          </p>
          {DAYS.map((day) => {
            const schedule = operatingHours.find(
              (hours) => hours.day.toLowerCase() === day,
            );
            let hours = "Hours unavailable";
            if (schedule) {
              if (!schedule.is_open) hours = "Closed";
              else if (schedule.is_24_hours) hours = "Open 24 hours";
              else if (schedule.open_time && schedule.close_time)
                hours = formatOperatingHours(schedule);
            }
            return (
              <div
                key={day}
                className={
                  "flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm " +
                  (day === today ? "bg-surface-muted" : "")
                }
              >
                <div>
                  <p className="font-medium capitalize text-text-primary">
                    {day}
                    {day === today && (
                      <span className="ml-2 text-xs text-text-secondary">
                        Today
                      </span>
                    )}
                  </p>
                  {schedule && isOvernightOperatingHours(schedule) && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Closes the following day
                    </p>
                  )}
                </div>
                <p className="text-text-secondary">{hours}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
