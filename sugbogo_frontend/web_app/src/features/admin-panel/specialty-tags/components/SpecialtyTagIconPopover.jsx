import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, Search } from "lucide-react";

import {
  SPECIALTY_TAG_ICONS,
  searchSpecialtyTagIcons,
} from "../constants/specialtyTagIcons";

/**
 * Renders a searchable specialty tag icon selection popover.
 *
 * Groups icons by category while browsing and switches to a flat result grid
 * when searching across icon names, categories, backend values, and keywords.
 */
export default function SpecialtyTagIconPopover({
  value,
  position,
  onSelect,
  popoverRef,
}) {
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim();
  const isSearching = normalizedSearch.length > 0;

  const filteredIcons = useMemo(
    () => searchSpecialtyTagIcons(search),
    [search],
  );

  const groupedIcons = useMemo(() => {
    return SPECIALTY_TAG_ICONS.reduce((groups, icon) => {
      const category = icon.category ?? "Other";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(icon);

      return groups;
    }, {});
  }, []);

  function renderIconButton({ value: iconValue, label, icon: Icon }) {
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
        {/* Selected state */}
        {isSelected && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-stroke-active text-background">
            <Check className="h-2 w-2" strokeWidth={3.5} />
          </span>
        )}

        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
    );
  }

  const popover = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] flex h-[400px] w-[360px] flex-col rounded-lg border border-stroke-strong bg-background shadow-xl"
      style={{
        top: position.top,
        left: position.left,
      }}
      role="listbox"
      aria-label="Specialty tag icon"
    >
      {/* Search */}
      <div className="border-b border-stroke p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            strokeWidth={2}
          />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search icons, categories, or keywords"
            autoFocus
            className={clsx(
              "h-10 w-full rounded-lg border border-stroke bg-background pl-9 pr-3 text-sm text-text-primary",
              "placeholder:text-text-secondary",
              "focus:border-stroke-active focus:outline-none ",
            )}
          />
        </div>
      </div>

      {/* Icon results */}
      <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {isSearching ? (
          filteredIcons.length > 0 ? (
            /* Search results */
            <div>
              <p className="mb-3 text-xs font-medium text-text-secondary">
                {filteredIcons.length}{" "}
                {filteredIcons.length === 1 ? "icon" : "icons"} found
              </p>

              <div className="grid grid-cols-6 gap-2">
                {filteredIcons.map(renderIconButton)}
              </div>
            </div>
          ) : (
            /* Empty search state */
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <Search
                  className="mx-auto mb-2 h-5 w-5 text-text-secondary"
                  strokeWidth={2}
                />

                <p className="text-sm font-medium text-text-primary">
                  No icons found
                </p>

                <p className="mt-1 text-xs text-text-secondary">
                  Try a different icon, category, or keyword.
                </p>
              </div>
            </div>
          )
        ) : (
          /* Categorized browsing */
          <div className="space-y-5">
            {Object.entries(groupedIcons).map(([category, icons]) => (
              <section key={category}>
                {/* Category heading */}
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {category}
                  </p>

                  <span className="text-[11px] text-text-tertiary">
                    {icons.length}
                  </span>
                </div>

                {/* Category icons */}
                <div className="grid grid-cols-6 gap-2">
                  {icons.map(renderIconButton)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popover, document.body);
}
