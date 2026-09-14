import { Plus, Sparkles, Tags } from "lucide-react";

import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import Button from "@/shared/components/Button";

import TransferSuggestionScanButton from "../transfer-review/TransferSuggestionScanButton";
import { TRANSIT_CONTEXTS, TRANSIT_MODES } from "./transitWorkspaceModes";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending review" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ignored", label: "Ignored" },
];

/**
 * Presents actions for the active network context while keeping major
 * navigation visually separate from temporary editing tools.
 */
export default function TransitNetworkContextActions({
  context,
  mode,
  statusFilter,
  onStatusFilterChange,
  onAddRoute,
  onAddPoint,
  onAddTransfer,
}) {
  const isBrowsing = mode === TRANSIT_MODES.BROWSE;

  if (!isBrowsing) {
    return (
      <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
        Editing mode · finish or cancel to change tools
      </span>
    );
  }

  if (context === TRANSIT_CONTEXTS.ROUTES) {
    return (
      <Button icon={Plus} onClick={onAddRoute}>
        Add Route
      </Button>
    );
  }

  if (context === TRANSIT_CONTEXTS.POINTS) {
    return (
      <Button icon={Plus} onClick={onAddPoint}>
        Add Point
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Transfer filtering and review actions */}
      <FilterMenu
        filters={[
          {
            key: "status",
            label: "Status",
            icon: Tags,
            options: STATUS_OPTIONS,
            value: statusFilter,
            onChange: onStatusFilterChange,
          },
        ]}
      />
      <Button
        variant={statusFilter === "pending" ? "primary" : "secondary"}
        size="sm"
        icon={Sparkles}
        aria-pressed={statusFilter === "pending"}
        onClick={() =>
          onStatusFilterChange(statusFilter === "pending" ? "" : "pending")
        }
      >
        Pending Suggestions
      </Button>
      <TransferSuggestionScanButton />
      <Button icon={Plus} onClick={onAddTransfer}>
        Add Transfer
      </Button>
    </div>
  );
}
