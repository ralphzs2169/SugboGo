import { Flag, Image as ImageIcon, Search, Tag } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import SortMenu from "@/features/admin-panel/components/data-table/SortMenu";

const REASON_OPTIONS = [
  { value: "text_flagged", label: "Text flagged" },
  { value: "image_flagged", label: "Image flagged" },
  { value: "local_cebuano_safety", label: "Potential violent threat" },
  { value: "provider_failure", label: "Check unavailable" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All statuses" },
];

const CONTENT_OPTIONS = [
  { value: "has_photos", label: "Has photos" },
  { value: "text_only", label: "Text only" },
];

const SORT_OPTIONS = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
];

function QueueFilters({ filters, onChange }) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <span className="sr-only">Search moderation reviews</span>
        <input
          type="search"
          placeholder="Search reviews, authors, businesses"
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
              value: filters.status === "all" ? "" : filters.status || "pending",
              onChange: (value) => onChange("status", value || "all"),
            },
            {
              key: "reason",
              label: "Reason",
              icon: Flag,
              options: REASON_OPTIONS,
              value: filters.reason,
              onChange: (value) => onChange("reason", value),
            },
            {
              key: "content",
              label: "Content",
              icon: ImageIcon,
              options: CONTENT_OPTIONS,
              value: filters.content,
              onChange: (value) => onChange("content", value),
            },
          ]}
        />
        <SortMenu
          value={filters.ordering}
          options={SORT_OPTIONS}
          onChange={(value) => onChange("ordering", value)}
          ariaLabel="Sort review moderation"
        />
      </div>
    </div>
  );
}

export default QueueFilters;
