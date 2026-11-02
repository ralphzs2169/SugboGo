import { useId, useLayoutEffect, useRef, useState } from "react";

/** Offer expansion only when the business description actually exceeds three rendered lines. */
export default function BusinessDescription({ description }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paragraph = useRef(null);
  const id = useId();
  useLayoutEffect(() => {
    const element = paragraph.current;
    if (!element) return undefined;
    function measure() {
      const lineHeight =
        Number.parseFloat(window.getComputedStyle(element).lineHeight) || 24;
      setOverflows(element.scrollHeight > lineHeight * 3 + 1);
    }
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [description]);
  return (
    <div className="mt-5">
      {/* Listing description */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Description
      </h2>
      <p
        ref={paragraph}
        id={id}
        className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary ${expanded ? "" : "line-clamp-3"}`}
      >
        {description || "No description provided."}
      </p>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 cursor-pointer text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
