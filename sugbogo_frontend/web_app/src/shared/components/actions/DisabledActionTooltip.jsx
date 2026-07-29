import { Tooltip } from "react-tooltip";

/**
 * Wrapper for disabled actions that need explanation.
 *
 * Disabled buttons do not trigger hover events reliably,
 * so the tooltip is attached to a wrapper element.
 */
export default function DisabledActionTooltip({ id, message, children }) {
  return (
    <>
      <span
        data-tooltip-id={id}
        data-tooltip-content={message}
        className="inline-flex"
      >
        {children}
      </span>

      <Tooltip id={id} />
    </>
  );
}
