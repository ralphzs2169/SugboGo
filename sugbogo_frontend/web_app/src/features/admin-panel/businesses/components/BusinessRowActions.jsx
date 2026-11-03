import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  FileText,
  Ellipsis,
  ClipboardList,
  Ban,
  CirclePlay,
} from "lucide-react";
import Button from "@/shared/components/Button";
import Flyout from "@/shared/components/overlay/Flyout";

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-interaction-hover focus:bg-interaction-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stroke-active";

/** Compose verified row actions using the existing portal overlay and menu conventions. */
export default function BusinessRowActions({
  business,
  onViewBusiness,
  onManageStatus,
  showViewBusiness = true,
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const panel = useRef(null);
  const focusLast = useRef(false);
  const menuId = useId();
  const navigate = useNavigate();
  const canTransition = ["active", "suspended"].includes(business.status);

  useEffect(() => {
    if (!open) return;
    const items = panel.current?.querySelectorAll('[role="menuitem"]');
    (focusLast.current ? items?.[items.length - 1] : items?.[0])?.focus();
    function dismiss(event) {
      if (
        !panel.current?.contains(event.target) &&
        !anchor.current?.contains(event.target)
      )
        setOpen(false);
    }
    function closeOther(event) {
      if (event.detail !== business.id) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("business-action-open", closeOther);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("business-action-open", closeOther);
    };
  }, [open, business.id]);

  function close() {
    setOpen(false);
    anchor.current?.focus();
  }

  function openMenu(last = false) {
    focusLast.current = last;
    document.dispatchEvent(
      new CustomEvent("business-action-open", { detail: business.id }),
    );
    setOpen(true);
  }

  function navigateMenu(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      panel.current.querySelectorAll('[role="menuitem"]'),
    );
    const index = items.indexOf(document.activeElement);
    let next = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  return (
    <div
      className="flex items-center justify-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {showViewBusiness && (
        <Button
          variant="action"
          size="md"
          icon={Eye}
          iconOnly
          aria-label="View business"
          tooltipMessage="View business"
          onClick={() => onViewBusiness(business)}
        />
      )}
      <button
        ref={anchor}
        type="button"
        aria-label="More actions"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-stroke text-text-secondary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info"
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            openMenu(event.key === "ArrowUp");
          }
        }}
      >
        <Ellipsis aria-hidden="true" size={18} />
      </button>
      <Flyout anchorRef={anchor} ref={panel} open={open} placement="bottom-end">
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions for ${business.name}`}
          className="max-h-[calc(100vh-1rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-stroke-strong bg-background py-1 text-text-primary shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setOpen(false);
          }}
          onKeyDown={navigateMenu}
        >
          {business.application_id != null && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={menuItemClass}
              onClick={() => {
                close();
                navigate(
                  `/admin-panel/business/application/${business.application_id}`,
                );
              }}
            >
              <FileText aria-hidden="true" size={16} />
              View Application
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={menuItemClass}
            onClick={() => {
              close();
              navigate(
                `/admin-panel/businesses/update-requests?business_id=${business.id}&type=all&status=all`,
              );
            }}
          >
            <ClipboardList aria-hidden="true" size={16} />
            View Update Requests
          </button>
          {canTransition && (
            <>
              <div role="separator" className="my-1 border-t border-stroke" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${menuItemClass} ${business.status === "active" ? "text-danger" : "text-text-primary"}`}
                onClick={() => {
                  close();
                  onManageStatus(
                    business,
                    business.status === "active" ? "suspend" : "reactivate",
                  );
                }}
              >
                {business.status === "active" ? (
                  <Ban aria-hidden="true" size={16} />
                ) : (
                  <CirclePlay aria-hidden="true" size={16} />
                )}
                {business.status === "active"
                  ? "Suspend Business"
                  : "Reactivate Business"}
              </button>
            </>
          )}
        </div>
      </Flyout>
    </div>
  );
}
