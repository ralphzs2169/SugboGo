import {
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

import Button from "@/shared/components/Button";

import { TRANSIT_CONTEXTS, TRANSIT_MODES } from "./transitWorkspaceModes";

function getModePresentation(context, mode, hasSelectedTransfer) {
  const presentations = {
    [TRANSIT_MODES.CREATE_ROUTE]: {
      label: "Creating Route",
      hint: "Enter the route code in the inspector.",
    },
    [TRANSIT_MODES.EDIT_ROUTE]: {
      label: "Editing Route",
      hint: "Update the selected route in the inspector.",
    },
    [TRANSIT_MODES.CREATE_VARIANT_DRAW]: {
      label: "Drawing Variant",
      hint: "Click the map to add route vertices in travel order.",
    },
    [TRANSIT_MODES.CREATE_VARIANT_ADJUST]: {
      label: "Creating Variant",
      hint: "Drag vertices or manage ordered Transit Points in the inspector.",
    },
    [TRANSIT_MODES.EDIT_VARIANT_DRAW]: {
      label: "Editing Route Path",
      hint: "Click the map to append vertices or drag existing vertices.",
    },
    [TRANSIT_MODES.EDIT_VARIANT_ADJUST]: {
      label: "Editing Route Path",
      hint: "Drag numbered vertices to adjust the LineString.",
    },
    [TRANSIT_MODES.ADD_POINT]: {
      label: "Adding Transit Point",
      hint: "Click the map to place the new managed Transit Point.",
    },
    [TRANSIT_MODES.EDIT_POINT]: {
      label: "Editing Transit Point",
      hint: "Drag the selected marker or click a new map location.",
    },
    [TRANSIT_MODES.CREATE_TRANSFER]: {
      label: "Creating Transfer",
      hint: "Choose the directed connection in the inspector.",
    },
    [TRANSIT_MODES.EDIT_TRANSFER]: {
      label: "Editing Transfer",
      hint: "Adjust the selected transfer connection in the inspector.",
    },
  };

  if (mode !== TRANSIT_MODES.BROWSE) {
    return presentations[mode];
  }

  if (context === TRANSIT_CONTEXTS.TRANSFERS && hasSelectedTransfer) {
    return {
      label: "Reviewing Transfer",
      hint: "Compare both routes and the proposed connection on the map.",
    };
  }

  return {
    label: "Browse",
    hint:
      context === TRANSIT_CONTEXTS.ROUTES
        ? "Select a route or directional variant to inspect it."
        : context === TRANSIT_CONTEXTS.POINTS
          ? "Select a Transit Point marker or list item to inspect it."
          : "Select a directed transfer to review it.",
  };
}

/**
 * Communicates the active map mode and keeps fullscreen and panel layout
 * controls keyboard-accessible without coupling them to editor state.
 */
export default function TransitWorkspaceToolbar({
  context,
  mode,
  hasSelectedTransfer,
  isBrowserCollapsed,
  isInspectorCollapsed,
  isFullscreen,
  isFullscreenSupported,
  onToggleBrowser,
  onToggleInspector,
  onToggleFullscreen,
}) {
  const presentation = getModePresentation(
    context,
    mode,
    hasSelectedTransfer,
  );
  const isEditing = mode !== TRANSIT_MODES.BROWSE;
  const interactionHint =
    isEditing && isInspectorCollapsed
      ? "Inspector collapsed. Expand it to save or cancel this edit."
      : presentation.hint;

  return (
    <div className="mb-4 flex shrink-0 flex-col gap-3 rounded-xl border border-stroke bg-surface px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      {/* Active mode and interaction guidance */}
      <div className="flex min-w-0 items-start gap-3" aria-live="polite">
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {presentation.label}
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-text-secondary">
            {interactionHint}
          </p>
          {isEditing && (
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Cancel safely with <kbd className="font-semibold">Esc</kbd>
              {mode.includes("variant") && (
                <>
                  {" "}· Undo geometry with {" "}
                  <kbd className="font-semibold">Ctrl/Cmd+Z</kbd>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Pure layout controls */}
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          variant="action"
          size="sm"
          icon={isBrowserCollapsed ? PanelLeftOpen : PanelLeftClose}
          iconOnly
          tooltipMessage={
            isBrowserCollapsed ? "Expand browser" : "Collapse browser"
          }
          aria-label={
            isBrowserCollapsed
              ? "Expand context browser"
              : "Collapse context browser"
          }
          aria-controls="transit-context-browser"
          aria-expanded={!isBrowserCollapsed}
          onClick={onToggleBrowser}
        />
        <Button
          variant="action"
          size="sm"
          icon={isInspectorCollapsed ? PanelRightOpen : PanelRightClose}
          iconOnly
          tooltipMessage={
            isInspectorCollapsed ? "Expand inspector" : "Collapse inspector"
          }
          aria-label={
            isInspectorCollapsed ? "Expand inspector" : "Collapse inspector"
          }
          aria-controls="transit-network-inspector"
          aria-expanded={!isInspectorCollapsed}
          onClick={onToggleInspector}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={isFullscreen ? Minimize2 : Maximize2}
          disabled={!isFullscreenSupported}
          disabledTooltip="Fullscreen is unavailable in this browser."
          aria-pressed={isFullscreen}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        </Button>
      </div>
    </div>
  );
}
