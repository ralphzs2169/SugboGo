import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";

/** Keeps custom form rendering separate from the menu's close event handler. */
function CustomMenuPanel({ renderContent, onClose }) {
  // The parent supplies the established dismissal and focus recovery behavior.
  return renderContent(onClose);
}

/** Shares anchored choices and optional custom input while preserving sort-menu defaults. */
export default function SortMenu({
  value,
  options,
  onChange,
  ariaLabel = "Sort items",
  triggerLabel,
  icon: Icon = ArrowDownUp,
  disabled = false,
  customContent,
  customValue = "custom",
  customOnly = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const panelRef = useRef(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    if (showCustom) panelRef.current?.querySelector("input:not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex='0']")?.focus();
    else optionRefs.current[Math.max(selectedIndex, 0)]?.focus();

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, selectedIndex, showCustom]);

  function handleKeyDown(event) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!isOpen || showCustom || options.length === 0) {
      return;
    }

    const focusedIndex = optionRefs.current.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const currentIndex = focusedIndex < 0 ? Math.max(selectedIndex, 0) : focusedIndex;
      const nextIndex = (currentIndex + direction + options.length) % options.length;
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : options.length - 1;
      optionRefs.current[nextIndex]?.focus();
    }
  }

  function closeMenu() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function chooseOption(optionValue) {
    if (customContent && optionValue === customValue) {
      setShowCustom(true);
      return;
    }
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${ariaLabel}: ${triggerLabel ?? selectedOption?.label ?? "Select sort"}`}
        disabled={disabled}
        aria-haspopup={customOnly || showCustom ? "dialog" : "menu"}
        aria-expanded={isOpen}
        onClick={() => { setShowCustom(customOnly); setIsOpen((previous) => !previous); }}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-stroke-strong bg-background px-3 text-xs font-medium text-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-interaction-hover focus:border-stroke-active focus:outline-none focus:ring-2 focus:ring-stroke-active/10"
      >
        <Icon className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
        <span>{triggerLabel ?? selectedOption?.label ?? "Sort"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          role={showCustom ? "dialog" : "menu"}
          aria-label={ariaLabel}
          className={`absolute right-0 top-full z-50 mt-2 max-h-[80vh] max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-stroke-strong bg-background shadow-lg ${showCustom ? "w-80 p-3" : "min-w-44 py-1"}`}
        >
          {showCustom ? <CustomMenuPanel renderContent={customContent} onClose={closeMenu} /> : options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => chooseOption(option.value)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text-primary hover:bg-interaction-hover focus:bg-interaction-hover focus:outline-none"
            >
              {option.label}
              {option.value === value && (
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
