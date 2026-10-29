import { cloneElement, useId } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";

/**
 * Reusable tooltip wrapper.
 *
 * Supports attaching tooltip behavior directly to the child element.
 */
export default function Tooltip({
  content,
  children,
  place = "right",
  asChild = false,
  className,
  openOnClick = false,
  closeEvents,
  globalCloseEvents,
}) {
  const id = `tooltip-${useId().replaceAll(":", "")}`;

  const props = {
    "data-tooltip-id": id,
    "data-tooltip-content": content,
  };

  return (
    <>
      {asChild ? (
        cloneElement(children, props)
      ) : (
        <span {...props} className="inline-flex">
          {children}
        </span>
      )}

      <ReactTooltip
        id={id}
        place={place}
        positionStrategy="fixed"
        openOnClick={openOnClick}
        closeEvents={closeEvents}
        globalCloseEvents={globalCloseEvents}
        className={`!rounded-md !bg-tooltip-background !text-tooltip-text !text-xs !font-medium ${className ?? "!px-1 !py-1"}`}
      />
    </>
  );
}
