import { Search, ShieldAlert } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import SortMenu from "@/features/admin-panel/components/data-table/SortMenu";

import { SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

const SIGNAL_OPTIONS = Object.entries(SIGNAL_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function QueueFilters({
  search,
  signal,
  ordering,
  onSearchChange,
  onSignalChange,
  onOrderingChange,
}) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" aria-hidden="true" />
        <span className="sr-only">Search suspicious reviews</span>
        <input
          type="search"
          placeholder="Search reviews, authors, businesses"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-lg border border-stroke bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterMenu
          filters={[
            {
              key: "signal",
              label: "Reliability signal",
              icon: ShieldAlert,
              options: SIGNAL_OPTIONS,
              value: signal,
              onChange: onSignalChange,
            },
          ]}
        />
        <SortMenu
          value={ordering}
          options={SORT_OPTIONS}
          onChange={onOrderingChange}
          ariaLabel="Sort suspicious reviews"
        />
      </div>
    </div>
  );
}

export default QueueFilters;
