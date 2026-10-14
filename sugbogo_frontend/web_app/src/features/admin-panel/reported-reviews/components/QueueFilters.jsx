import { Flag, Search, Tag } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import SortMenu from "@/features/admin-panel/components/data-table/SortMenu";

import { REPORT_REASONS } from "../utils/reportedReviewPresentation";

const REASON_OPTIONS = Object.entries(REPORT_REASONS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "most_reported", label: "Most Reported" },
  { value: "oldest", label: "Oldest Report" },
  { value: "newest", label: "Newest Report" },
];

function QueueFilters({
  search,
  reason,
  status,
  ordering,
  onSearchChange,
  onReasonChange,
  onStatusChange,
  onOrderingChange,
}) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <span className="sr-only">Search reported reviews</span>
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
              key: "reason",
              label: "Report reason",
              icon: Flag,
              options: REASON_OPTIONS,
              value: reason,
              onChange: onReasonChange,
            },
            {
              key: "status",
              label: "Review status",
              icon: Tag,
              options: STATUS_OPTIONS,
              value: status,
              onChange: onStatusChange,
            },
          ]}
        />
        <SortMenu
          value={ordering}
          options={SORT_OPTIONS}
          onChange={onOrderingChange}
          ariaLabel="Sort reported reviews"
        />
      </div>
    </div>
  );
}

export default QueueFilters;
