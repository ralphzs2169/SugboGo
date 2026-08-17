import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import clsx from "clsx";

/**
 * Provides a compact contextual menu for row-level administrative actions.
 *
 * The menu is rendered through a document-level portal so it can escape
 * table overflow and stacking contexts while remaining anchored to the trigger.
 */
export default function ActionMenu({ items = [], label = "Actions" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  function updatePosition() {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }

  function handleToggle() {
    if (!isOpen) {
      updatePosition();
    }

    setIsOpen((previous) => !previous);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsideClick(event) {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);

      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  function handleItemClick(item) {
    if (item.disabled) {
      return;
    }

    setIsOpen(false);
    item.onClick();
  }

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[9999] min-w-48 overflow-hidden rounded-lg border border-stroke-strong bg-background py-1 shadow-xl"
      style={{
        top: position?.top,
        right: position?.right,
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="my-1 border-t border-stroke"
              role="separator"
            />
          );
        }

        const Icon = item.icon;

        return (
          <button
            key={item.key ?? item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => handleItemClick(item)}
            className={clsx(
              "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              item.destructive
                ? "text-rose-600 hover:bg-rose-50"
                : "text-text-primary hover:bg-interaction-hover",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}

            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Menu trigger */}
      <div className="flex items-center justify-center">
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={handleToggle}
          className={clsx(
            "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg",
            "text-text-secondary transition-colors",
            "hover:bg-interaction-hover hover:text-text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            isOpen && "bg-interaction-hover text-text-primary",
          )}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Portaled action menu */}
      {isOpen && position && createPortal(menu, document.body)}
    </>
  );
}
