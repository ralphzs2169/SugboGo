import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check } from "lucide-react";

import { CLUSTER_ICONS } from "../constants/clusterIcons";

/**
 * Renders the cluster icon selection popover.
 *
 * The popover is rendered through a document-level portal so it can escape
 * modal stacking and overflow contexts while remaining positioned by the picker.
 */
export default function ClusterIconPopover({
  value,
  position,
  onSelect,
  popoverRef,
}) {
  const popover = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-80 rounded-lg border border-stroke-strong bg-background p-3 shadow-xl"
      style={{
        top: position.top,
        left: position.left,
      }}
      role="listbox"
      aria-label="Cluster icon"
    >
      <div className="grid grid-cols-5 gap-2.5">
        {CLUSTER_ICONS.map(({ value: iconValue, label, icon: Icon }) => {
          const isSelected = value === iconValue;

          return (
            <button
              key={iconValue}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={label}
              title={label}
              onClick={() => onSelect(iconValue)}
              className={clsx(
                "group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-all duration-150 ease-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isSelected
                  ? "border-stroke-active bg-stroke/5 text-text-primary"
                  : "border-stroke bg-background text-text-secondary hover:border-stroke-active hover:bg-interaction-hover hover:text-text-primary",
              )}
            >
              {isSelected && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-stroke-active text-background">
                  <Check className="h-2 w-2" strokeWidth={3.5} />
                </span>
              )}

              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );

  return createPortal(popover, document.body);
}
