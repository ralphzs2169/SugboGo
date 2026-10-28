import { CalendarDays } from "lucide-react";

import SortMenu from "../../components/data-table/SortMenu";

const INTERVALS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

/** Selects supported reporting intervals independently of the period and data hook. */
export default function AnalyticsIntervalControl({
  value = "daily",
  onChange,
  disabled = false,
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary">Interval</span>
      <SortMenu
        ariaLabel="Reporting interval"
        icon={CalendarDays}
        value={value}
        onChange={onChange}
        options={INTERVALS}
        disabled={disabled}
      />
    </div>
  );
}
