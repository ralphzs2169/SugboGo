import { Flag, Search, Tag } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import SortMenu from "@/features/admin-panel/components/data-table/SortMenu";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "upheld", label: "Upheld" },
  { value: "dismissed", label: "Dismissed" },
  { value: "withdrawn", label: "Withdrawn" },
];

const REASON_OPTIONS = [
  { value: "fake_review", label: "Fake or non-genuine review" },
  { value: "abusive_content", label: "Abusive or inappropriate content" },
  { value: "misleading_information", label: "False or materially misleading information" },
  { value: "conflict_of_interest", label: "Conflict of interest" },
  { value: "wrong_business", label: "Wrong business or unrelated experience" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "status", label: "Status A–Z" },
  { value: "-status", label: "Status Z–A" },
];

export default function DisputeQueueFilters({ filters, onChange }) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <span className="sr-only">Search review disputes</span>
        <input
          type="search"
          placeholder="Search disputes, merchants, businesses"
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          className="w-full rounded-lg border border-stroke bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterMenu
          filters={[
            {
              key: "status",
              label: "Status",
              icon: Tag,
              options: STATUS_OPTIONS,
              value: filters.status,
              onChange: (value) => onChange("status", value),
            },
            {
              key: "reason",
              label: "Reason",
              icon: Flag,
              options: REASON_OPTIONS,
              value: filters.reason,
              onChange: (value) => onChange("reason", value),
            },
          ]}
        />
        <SortMenu
          value={filters.ordering}
          options={SORT_OPTIONS}
          onChange={(value) => onChange("ordering", value)}
          ariaLabel="Sort review disputes"
        />
      </div>
    </div>
  );
}
