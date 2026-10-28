import { useId, useState } from "react";
import Button from "@/shared/components/Button";
import { DEFAULT_ANALYTICS_PERIOD, serializeReportingPeriod } from "../utils/reportingPeriod";

const PRESETS = ["7", "30", "90"];
const DEFAULT_SELECTION = { period: DEFAULT_ANALYTICS_PERIOD };
const INPUT_CLASS = "min-h-11 w-full min-w-0 cursor-pointer rounded-md border-2 border-stroke bg-background px-3 py-2 text-sm text-text-primary focus:border-stroke-active focus:outline-none";

/** Keeps custom dates in a local draft until a complete ordered range is applied. */
function CustomRangeEditor({ initialRange, onApply }) {
  const [start, setStart] = useState(initialRange.start_date ?? "");
  const [end, setEnd] = useState(initialRange.end_date ?? "");
  const id = useId();
  const reversed = Boolean(start && end && end < start);
  const complete = Boolean(start && end && !reversed);

  function apply(event) {
    event.preventDefault();
    if (!complete) return;
    onApply(serializeReportingPeriod({ period: "custom", start_date: start, end_date: end }));
  }

  return (
    <form onSubmit={apply} className="mt-3 space-y-2">
      {/* Draft calendar dates and explicit apply action */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor={`${id}-start`} className="mb-1 block text-sm font-medium text-text-primary">Start date</label>
          <input id={`${id}-start`} type="date" required value={start} onChange={(event) => setStart(event.target.value)} aria-describedby={`${id}-help`} aria-invalid={reversed} className={INPUT_CLASS} />
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor={`${id}-end`} className="mb-1 block text-sm font-medium text-text-primary">End date</label>
          <input id={`${id}-end`} type="date" required value={end} onChange={(event) => setEnd(event.target.value)} aria-describedby={`${id}-help`} aria-invalid={reversed} className={INPUT_CLASS} />
        </div>
        <Button type="submit" variant="secondary" disabled={!complete} className="min-h-11">Apply range</Button>
      </div>
      <p id={`${id}-help`} className="text-sm text-text-secondary">
        {reversed ? "End date must be on or after start date." : "Choose both dates, then apply. Calendar dates use Asia/Manila."}
      </p>
    </form>
  );
}

/** Controls applied reporting periods while keeping incomplete custom edits out of requests.
 * It sends calendar dates unchanged and leaves reporting timezone rules to the API.
 */
export default function AnalyticsPeriodControl({ value = DEFAULT_SELECTION, onChange, disabled = false }) {
  const [customOpen, setCustomOpen] = useState(false);
  const selected = String(value.period);
  const showCustom = customOpen || selected === "custom";
  const appliedLabel = selected === "custom"
    ? `${value.start_date} to ${value.end_date}`
    : `Last ${selected} days`;

  function choosePreset(period) {
    setCustomOpen(false);
    onChange(serializeReportingPeriod({ period }));
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-stroke bg-background p-4">
      {/* Applied selection and accessible preset buttons */}
      <legend className="px-1 text-sm font-medium text-text-primary">Reporting period</legend>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={!customOpen && selected === period}
            onClick={() => choosePreset(period)}
            className={`min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60 ${!customOpen && selected === period ? "border-primary bg-primary/10 text-text-primary" : "border-stroke text-text-secondary hover:bg-surface"}`}
          >
            {period}D
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showCustom}
          aria-expanded={showCustom}
          onClick={() => setCustomOpen(true)}
          className={`min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60 ${showCustom ? "border-primary bg-primary/10 text-text-primary" : "border-stroke text-text-secondary hover:bg-surface"}`}
        >
          Custom
        </button>
        <p className="basis-full text-sm text-text-secondary sm:ml-auto sm:basis-auto">Applied: {appliedLabel}</p>
      </div>

      {/* Custom draft never changes the applied range until submission */}
      {showCustom && (
        <CustomRangeEditor
          key={`${selected}:${value.start_date ?? ""}:${value.end_date ?? ""}`}
          initialRange={value}
          onApply={(range) => {
            onChange(range);
            setCustomOpen(false);
          }}
        />
      )}
    </fieldset>
  );
}
