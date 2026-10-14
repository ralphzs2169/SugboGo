import { useEffect, useRef, useState } from "react";

function ReportExplanation({ explanation, reportId }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text || !explanation) {
      return;
    }

    function measureOverflow() {
      const lineHeight = Number.parseFloat(window.getComputedStyle(text).lineHeight);
      setOverflows(text.scrollHeight > lineHeight * 3 + 1);
    }

    measureOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => window.removeEventListener("resize", measureOverflow);
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(text.parentElement);
    return () => observer.disconnect();
  }, [explanation, expanded]);

  if (!explanation) {
    return null;
  }

  return (
    <div className="mt-2 min-w-0">
      <p
        ref={textRef}
        id={`report-explanation-${reportId}`}
        className={`whitespace-pre-wrap break-words text-sm leading-5 text-text-secondary ${expanded ? "" : "line-clamp-3"}`}
      >
        <span className="sr-only">Reporter's explanation: </span>
        {explanation}
      </p>
      {overflows && (
        <button
          type="button"
          aria-controls={`report-explanation-${reportId}`}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show less" : "Show more"} of explanation for report #${reportId}`}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export default ReportExplanation;
