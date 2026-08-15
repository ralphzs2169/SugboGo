import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";

import { CLUSTER_ICONS } from "../constants/clusterIcons";

const POPOVER_GAP = 8;
const POPOVER_HEIGHT = 280;
const VIEWPORT_PADDING = 12;

/**
 * Visual cluster selector for admin forms.
 *
 * Displays each cluster with its configured icon and renders the option list
 * through a portal so the dropdown can escape modal stacking and overflow.
 */
export default function ClusterSelectInput({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = "Select a cluster",
  clusters = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const selectedCluster = clusters.find(
    (cluster) => String(cluster.id) === String(value),
  );

  const selectedIcon = CLUSTER_ICONS.find(
    (icon) => icon.value === selectedCluster?.icon,
  );

  const SelectedIcon = selectedIcon?.icon;

  function handleSelect(clusterId) {
    onChange({
      target: {
        name,
        value: String(clusterId),
      },
    });

    setIsOpen(false);
  }

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

    setPosition({
      top: Math.max(VIEWPORT_PADDING, top),
      left: Math.max(VIEWPORT_PADDING, rect.left),
      width: rect.width,
    });
  }

  // Position the dropdown relative to the trigger when opened.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
  }, [isOpen]);

  // Keep the dropdown aligned while the viewport changes.
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

  // Close the dropdown with Escape.
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

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-stroke-strong bg-background shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
      role="listbox"
      aria-labelledby={`${id}-label`}
    >
      <div className="max-h-64 overflow-y-auto p-1.5">
        {clusters.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-text-secondary">
            No clusters available.
          </div>
        ) : (
          clusters.map((cluster) => {
            const clusterIcon = CLUSTER_ICONS.find(
              (icon) => icon.value === cluster.icon,
            );

            const Icon = clusterIcon?.icon;

            const isSelected = String(cluster.id) === String(value);

            return (
              <button
                key={cluster.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(cluster.id)}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "bg-stroke/5 text-text-primary"
                    : "text-text-primary hover:bg-interaction-hover",
                )}
              >
                <span
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                    isSelected
                      ? "border-stroke-active text-text-primary"
                      : "border-stroke text-text-secondary",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" strokeWidth={2} />}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  {cluster.name}
                </span>

                {isSelected && (
                  <Check
                    className="h-4 w-4 shrink-0 text-text-primary"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef}>
      {/* Field label */}
      {label && (
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      {/* Select trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={Boolean(error)}
        className={clsx(
          "flex w-full items-center gap-3 rounded-md border-2 bg-background px-4 py-3 text-left text-sm outline-none transition",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          error
            ? "border-danger focus:border-danger"
            : "border-stroke focus:border-stroke-active",
        )}
      >
        {SelectedIcon && (
          <span className="flex shrink-0 items-center justify-center text-text-secondary">
            <SelectedIcon className="h-5 w-5" strokeWidth={2} />
          </span>
        )}

        <span
          className={clsx(
            "min-w-0 flex-1 truncate",
            selectedCluster ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {selectedCluster?.name ?? placeholder}
        </span>

        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-text-secondary transition-transform",
            isOpen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-bold text-danger">
          {error}
        </p>
      )}

      {/* Dropdown portal */}
      {createPortal(popover, document.body)}
    </div>
  );
}
