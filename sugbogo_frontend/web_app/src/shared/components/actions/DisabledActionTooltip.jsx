import { Tooltip } from "react-tooltip";

export default function DisabledActionTooltip({ id, message, children }) {
  return (
    <>
      {" "}
      <span
        data-tooltip-id={id}
        data-tooltip-content={message}
        className="inline-flex"
      >
        {" "}
        {children}{" "}
      </span>{" "}
      <Tooltip id={id} />{" "}
    </>
  );
}
