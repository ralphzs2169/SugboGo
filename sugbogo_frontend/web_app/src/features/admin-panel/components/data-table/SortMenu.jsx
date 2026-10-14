import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";

/** Show a controlled sort choice in the Admin filter popover style. */
export default function SortMenu({
  value,
  options,
  onChange,
  ariaLabel = "Sort items",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    optionRefs.current[Math.max(selectedIndex, 0)]?.focus();

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, selectedIndex]);

  function handleKeyDown(event) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!isOpen || options.length === 0) {
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

  function chooseOption(optionValue) {
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
        aria-label={`${ariaLabel}: ${selectedOption?.label ?? "Select sort"}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-stroke-strong bg-background px-3 text-xs font-medium text-text-primary transition-colors hover:bg-interaction-hover focus:border-stroke-active focus:outline-none focus:ring-2 focus:ring-stroke-active/10"
      >
        <ArrowDownUp className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
        <span>{selectedOption?.label ?? "Sort"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-lg border border-stroke-strong bg-background py-1 shadow-lg"
        >
          {options.map((option, index) => (
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
