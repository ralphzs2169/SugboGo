import { cloneElement, useState } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";

let tooltipCounter = 0;

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
}) {
  const [id] = useState(() => {
    tooltipCounter += 1;
    return `tooltip-${tooltipCounter}`;
  });

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
        className="!rounded-md !bg-tooltip-background !text-tooltip-text !px-1 !py-1 !text-xs !font-medium"
      />
    </>
  );
}
