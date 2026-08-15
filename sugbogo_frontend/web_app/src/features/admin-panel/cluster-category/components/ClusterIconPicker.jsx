import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ImagePlus } from "lucide-react";

import { CLUSTER_ICONS } from "../constants/clusterIcons";
import ClusterIconPopover from "./ClusterIconPopover";

const POPOVER_GAP = 6;
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 280;
const VIEWPORT_PADDING = 12;

/**
 * Provides a compact visual selector for business cluster icons.
 *
 * Handles the trigger, popover positioning, selection state, and interaction
 * behavior while delegating the icon grid to ClusterIconPopover.
 */
export default function ClusterIconPicker({
  value,
  onChange,
  error,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const selected = CLUSTER_ICONS.find((icon) => icon.value === value);

  function closePopover() {
    setIsOpen(false);
  }

  function updatePosition() {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const shouldOpenAbove =
      spaceBelow < POPOVER_HEIGHT + POPOVER_GAP && spaceAbove > spaceBelow;

    const top = shouldOpenAbove
      ? rect.top - POPOVER_HEIGHT - POPOVER_GAP
      : rect.bottom + POPOVER_GAP;

    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;

    const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, maxLeft));

    setPosition({
      top: Math.max(VIEWPORT_PADDING, top),
      left,
    });
  }

  function handleSelect(iconValue) {
    onChange(iconValue);
    closePopover();
  }

  // Position the popover relative to the trigger when it opens.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
  }, [isOpen]);

  // Keep the popover positioned with the trigger while the viewport changes.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleViewportChange() {
      updatePosition();
    }

    function handlePointerDown(event) {
      const target = event.target;

      const clickedInsideContainer = containerRef.current?.contains(target);

      const clickedInsidePopover = popoverRef.current?.contains(target);

      if (!clickedInsideContainer && !clickedInsidePopover) {
        closePopover();
      }
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  // Close the picker with Escape and return focus to the trigger.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }

      closePopover();
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef}>
      {/* Field label */}
      <div className="mb-2 block text-sm font-medium text-text-primary">
        Icon
        {required && <span className="ml-1 text-danger">*</span>}
      </div>

      {/* Icon trigger */}
      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={selected ? selected.label : "Select an icon"}
          className={clsx(
            "flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border-2 bg-background transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            error
              ? "border-danger"
              : "border-stroke hover:border-stroke-active",
          )}
        >
          {selected ? (
            <selected.icon
              className="h-5 w-5 text-text-primary"
              strokeWidth={2}
            />
          ) : (
            <ImagePlus
              className="h-5 w-5 text-text-secondary"
              strokeWidth={2}
            />
          )}
        </button>

        {/* Dropdown affordance */}
        <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-stroke-strong bg-background">
          <ChevronDown
            className={clsx(
              "h-2.5 w-2.5 text-text-secondary transition-transform",
              isOpen && "rotate-180",
            )}
            strokeWidth={2.5}
          />
        </span>
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {/* Icon selection popover */}
      {isOpen && (
        <ClusterIconPopover
          value={value}
          position={position}
          onSelect={handleSelect}
          popoverRef={popoverRef}
        />
      )}
    </div>
  );
}
