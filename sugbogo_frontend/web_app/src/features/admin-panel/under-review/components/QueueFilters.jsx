import { ChevronDown, Flag, Image as ImageIcon, Search } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";

const REASON_OPTIONS = [
  { value: "text_flagged", label: "Text flagged" },
  { value: "image_flagged", label: "Image flagged" },
  { value: "local_cebuano_safety", label: "Potential violent threat" },
  { value: "provider_failure", label: "Check unavailable" },
];

const CONTENT_OPTIONS = [
  { value: "has_photos", label: "Has photos" },
  { value: "text_only", label: "Text only" },
];

function QueueFilters({ filters, onChange }) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <span className="sr-only">Search held reviews</span>
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
        <label className="relative inline-flex items-center">
          <span className="sr-only">Sort under review queue</span>
          <select
            aria-label="Sort under review queue"
            value={filters.ordering}
            onChange={(event) => onChange("ordering", event.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-md border border-stroke-strong bg-background py-2 pl-3 pr-8 text-xs font-medium text-text-primary outline-none hover:bg-interaction-hover focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}

export default QueueFilters;
