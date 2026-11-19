import { Plus } from "lucide-react";

import Button from "@/shared/components/Button";

import { TRANSIT_CONTEXTS, TRANSIT_MODES } from "./transitWorkspaceModes";

/**
 * Presents actions for the active network context while keeping major
 * navigation visually separate from temporary editing tools.
 */
export default function TransitNetworkContextActions({
  context,
  mode,
  onAddRoute,
  onAddPoint,
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

  return (
    <Button icon={Plus} onClick={onAddPoint}>
      Add Point
    </Button>
  );
}
