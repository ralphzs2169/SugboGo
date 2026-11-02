import { ChevronDown, Clock, Moon } from "lucide-react";
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
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <Clock size={14} aria-hidden="true" /> Operating hours
      </h2>
      {/* Live operating state */}
      <div className="mt-2 flex flex-col items-start gap-3">
        <p
          role="status"
          className={
            "flex min-w-0 items-start gap-2 text-sm [overflow-wrap:anywhere] " +
            (summary.isOpen ? "text-success" : "text-text-secondary")
          }
        >
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
          className="mt-4 space-y-1 rounded-lg border border-stroke p-1"
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
                  "flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg px-2.5 py-2.5 text-sm " +
                  (day === today ? "bg-primary/10" : "")
                }
              >
                <div>
                  <p
                    className={
                      "font-medium capitalize " +
                      (day === today ? "text-primary" : "text-text-secondary")
                    }
                  >
                    {day}
                    {day === today && (
                      <span className="ml-2 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Today
                      </span>
                    )}
                  </p>
                  {schedule && isOvernightOperatingHours(schedule) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                      <Moon size={12} aria-hidden="true" /> Overnight · closes
                      the following day
                    </p>
                  )}
                </div>
                <p
                  className={
                    "min-w-0 text-right text-sm leading-5 " +
                    (day === today
                      ? "font-semibold text-text-primary"
                      : "text-text-secondary")
                  }
                >
                  {hours}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
