import { useState } from "react";
import { CalendarDays, Flag, Tag } from "lucide-react";
import Button from "@/shared/components/Button";
import FilterMenu from "../../components/data-table/FilterMenu";
import SortMenu from "../../components/data-table/SortMenu";
import { REVIEW_STATUSES } from "../utils/allReviewPresentation";

/** Validate date bounds together before sending the backend an inclusive Manila range. */
function DateRangeForm({ filters, onApply, onClose }) {
  const [start, setStart] = useState(filters.start_date);
  const [end, setEnd] = useState(filters.end_date);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (start && end && start > end) {
      setError("End date must be on or after start date.");
      return;
    }
    onApply({ start_date: start, end_date: end });
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-text-secondary">
        Submission dates · Philippine time
      </p>
      <label className="block text-xs font-medium text-text-primary">
        From
        <input
          type="date"
          value={start}
          onChange={(event) => {
            setStart(event.target.value);
            setError("");
          }}
          className="mt-1 h-9 w-full rounded-md border border-stroke-strong bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-info"
        />
      </label>
      <label className="block text-xs font-medium text-text-primary">
        To
        <input
          type="date"
          max="9999-12-30"
          value={end}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "all-review-date-error" : undefined}
          onChange={(event) => {
            setEnd(event.target.value);
            setError("");
          }}
          className="mt-1 h-9 w-full rounded-md border border-stroke-strong bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-info"
        />
      </label>
      {error && (
        <p
          id="all-review-date-error"
          role="alert"
          className="text-xs text-danger"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit">
          Apply dates
        </Button>
      </div>
    </form>
  );
}

/** Reuse the Businesses filter menu and the shared custom date/sort popover. */
export default function AllReviewFilters({ filters, onChange }) {
  const hasDates = Boolean(filters.start_date || filters.end_date);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <FilterMenu
        ariaLabel="Filter reviews"
        filters={[
          {
            key: "status",
            label: "Status",
            icon: Tag,
            options: Object.entries(REVIEW_STATUSES).map(([value, status]) => ({
              value,
              label: status.label,
            })),
            value: filters.status,
            onChange: (status) => onChange({ status }),
          },
          {
            key: "reported",
            label: "Reported",
            icon: Flag,
            options: [
              { value: "true", label: "Reported" },
              { value: "false", label: "Not reported" },
            ],
            value: filters.reported,
            onChange: (reported) => onChange({ reported }),
          },
        ]}
      />
      <SortMenu
        value={hasDates ? "custom" : "all"}
        options={[
          { value: "all", label: "Any submission date" },
          { value: "custom", label: "Custom date range" },
        ]}
        icon={CalendarDays}
        ariaLabel="Filter submission dates"
        triggerLabel={
          hasDates
            ? `${filters.start_date || "Any"} – ${filters.end_date || "Any"}`
            : "Submission date"
        }
        onChange={() => onChange({ start_date: "", end_date: "" })}
        customContent={(onClose) => (
          <DateRangeForm
            filters={filters}
            onApply={onChange}
            onClose={onClose}
          />
        )}
      />
    </div>
  );
}
