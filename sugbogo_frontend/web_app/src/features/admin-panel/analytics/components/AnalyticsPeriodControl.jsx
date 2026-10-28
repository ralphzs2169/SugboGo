import { readablePeriod } from "../utils/reportClarity";
import SortMenu from "../../components/data-table/SortMenu";
import { CalendarDays } from "lucide-react";
import { useId, useState } from "react";
import Button from "@/shared/components/Button";
import { DEFAULT_ANALYTICS_PERIOD, serializeReportingPeriod } from "../utils/reportingPeriod";

const PRESETS = ["7", "30", "90"];
const DEFAULT_SELECTION = { period: DEFAULT_ANALYTICS_PERIOD };
const INPUT_CLASS = "min-h-11 w-full min-w-0 cursor-pointer rounded-md border-2 border-stroke bg-background px-3 py-2 text-sm text-text-primary focus:border-stroke-active focus:outline-none";

/** Keeps custom dates in a local draft until a complete ordered range is applied. */
function CustomRangeEditor({ initialRange, onApply, onCancel }) {
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
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
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
export default function AnalyticsPeriodControl({ value = DEFAULT_SELECTION, onChange, disabled = false, compact = false }) {
  const selected = String(value.period);
  const appliedLabel = selected === "custom" ? readablePeriod(value) : `Last ${selected} days`;
  return (
    <div className={compact ? "min-w-0" : "min-w-0 rounded-xl border border-stroke bg-background p-4"}>
      {/* Reuse Moderation's anchored menu, keyboard navigation and dismissal behavior. */}
      <SortMenu value={selected} disabled={disabled} ariaLabel="Reporting period" icon={CalendarDays} triggerLabel={appliedLabel}
        options={[...PRESETS.map((period) => ({value:period,label:`Last ${period} days`})),{value:"custom",label:"Custom range"}]}
        onChange={(period) => onChange(serializeReportingPeriod({period}))}
        customContent={(close) => <CustomRangeEditor key={`${selected}:${value.start_date}:${value.end_date}`} initialRange={value} onCancel={close} onApply={(range) => { onChange(range); close(); }} />}
      />
    </div>
  );
}
