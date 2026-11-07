import { useId, useState } from "react";
import { CalendarDays, Layers, User, Zap } from "lucide-react";
import Button from "@/shared/components/Button";
import FilterMenu from "../../components/data-table/FilterMenu";
import SortMenu from "../../components/data-table/SortMenu";
import { ACTIVITY_ACTIONS, ACTIVITY_MODULES } from "../constants/activityLogOptions";

const inputClass = "mt-1 h-9 w-full rounded-md border border-stroke-strong bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-info";

/** Apply both date bounds together using the existing management date-popover pattern. */
function DateRangeForm({ filters, onApply, onClose }) {
  const [start, setStart] = useState(filters.start_date);
  const [end, setEnd] = useState(filters.end_date);
  const [error, setError] = useState("");
  const errorId = useId();

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
      <p className="text-xs text-text-secondary">Activity dates · Philippine time</p>
      <label className="block text-xs font-medium text-text-primary">
        Start date
        <input
          type="date"
          value={start}
          max="9999-12-30"
          onChange={(event) => {
            setStart(event.target.value);
            setError("");
          }}
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-medium text-text-primary">
        End date
        <input
          type="date"
          value={end}
          max="9999-12-30"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setEnd(event.target.value);
            setError("");
          }}
          className={inputClass}
        />
      </label>
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button size="sm" type="submit">Apply dates</Button>
      </div>
    </form>
  );
}

/** Preserve actor IDs as strings while validating the backend's positive bigint bounds. */
function ActorForm({ actorId, onApply, onClose }) {
  const [value, setValue] = useState(actorId);
  const [error, setError] = useState("");
  const errorId = useId();

  function submit(event) {
    event.preventDefault();
    const identifier = value.trim();
    if (
      identifier && (
        !/^[1-9][0-9]{0,18}$/.test(identifier) ||
        BigInt(identifier) > 9223372036854775807n
      )
    ) {
      setError("Enter a valid positive user identifier.");
      return;
    }
    onApply({ actor_id: identifier });
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs font-medium text-text-primary">
        Administrator / user ID
        <input
          type="text"
          inputMode="numeric"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          className={inputClass}
        />
      </label>
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button size="sm" type="submit">Apply user</Button>
      </div>
    </form>
  );
}

/** Reuse shared filter menus without adding unsupported free-text searching. */
export default function ActivityLogFilters({ filters, onChange }) {
  const hasDates = Boolean(filters.start_date || filters.end_date);
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>div]:max-w-full [&>div>span]:min-h-9 [&>div>span]:max-w-full [&_button[aria-haspopup]]:h-9 [&_button[aria-haspopup]]:max-w-full [&_button[aria-haspopup]]:whitespace-nowrap [&_button[aria-haspopup]>span]:min-w-0 [&_button[aria-haspopup]>span]:truncate [&_button[aria-haspopup]>svg]:shrink-0 [&_[role=dialog]]:w-80 [&_[role=dialog]]:max-w-[calc(100vw-2rem)]">
      <FilterMenu
        ariaLabel="Filter activities"
        filters={[
          {
            key: "module",
            label: "Module",
            icon: Layers,
            options: ACTIVITY_MODULES,
            value: filters.module,
            onChange: (module) => onChange({ module }),
          },
          {
            key: "action",
            label: "Action type",
            icon: Zap,
            options: ACTIVITY_ACTIONS,
            value: filters.action,
            onChange: (action) => onChange({ action }),
          },
        ]}
      />
      <SortMenu
        value={filters.actor_id ? "custom" : "all"}
        options={[
          { value: "all", label: "Any administrator / user" },
          { value: "custom", label: "Specific user ID" },
        ]}
        icon={User}
        ariaLabel="Filter by administrator or user"
        triggerLabel={filters.actor_id ? `User #${filters.actor_id}` : "User ID"}
        onChange={() => onChange({ actor_id: "" })}
        customContent={(onClose) => (
          <ActorForm actorId={filters.actor_id} onApply={onChange} onClose={onClose} />
        )}
      />
      <SortMenu
        value={hasDates ? "custom" : "all"}
        options={[
          { value: "all", label: "Any activity date" },
          { value: "custom", label: "Custom date range" },
        ]}
        icon={CalendarDays}
        ariaLabel="Filter activity dates"
        triggerLabel={hasDates
          ? `${filters.start_date || "Any"} – ${filters.end_date || "Any"}`
          : "Date range"}
        onChange={() => onChange({ start_date: "", end_date: "" })}
        customContent={(onClose) => (
          <DateRangeForm filters={filters} onApply={onChange} onClose={onClose} />
        )}
      />
    </div>
  );
}
