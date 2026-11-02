import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, Ellipsis } from "lucide-react";
import Button from "@/shared/components/Button";
import Flyout from "@/shared/components/overlay/Flyout";

/** Compose supported row actions with the shared portal overlay and menu styling. */
export default function BusinessRowActions({ business, onViewBusiness }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const panel = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    (panel.current?.querySelector("button") ?? panel.current?.firstElementChild)?.focus();
    function dismiss(event) {
      if (!panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) setOpen(false);
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

  return (
    <div className="flex items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
      <Button variant="action" size="md" icon={Eye} iconOnly tooltipMessage="View business" onClick={() => onViewBusiness(business)} />
      <>
        <button ref={anchor} type="button" aria-label="More actions" title="More actions" aria-haspopup="menu" aria-expanded={open}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-stroke text-text-secondary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info"
          onClick={() => {
            document.dispatchEvent(new CustomEvent("business-action-open", { detail: business.id }));
            setOpen(!open);
          }}>
          <Ellipsis aria-hidden="true" size={18} />
        </button>
        <Flyout anchorRef={anchor} ref={panel} open={open} placement="bottom-end">
          <div role="menu" tabIndex={-1} aria-label="Business actions" className="w-52 rounded-lg border border-stroke-strong bg-background py-1 shadow-lg"
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); close(); }
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                panel.current?.querySelector("button")?.focus();
              }
            }}>
            {business.application_id != null ? <button type="button" role="menuitem" className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-interaction-hover focus:bg-interaction-hover focus:outline-none"
              onClick={() => {
                close();
                navigate(`/admin-panel/business/application/${business.application_id}`);
              }}>
              <FileText aria-hidden="true" size={16} />View Application
            </button> : (
              <p role="status" className="px-3 py-2 text-sm text-text-secondary">No linked application</p>
            )}
          </div>
        </Flyout>
      </>
    </div>
  );
}
