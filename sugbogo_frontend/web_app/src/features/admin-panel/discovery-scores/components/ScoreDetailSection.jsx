import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Keep each dialog section independent and mounted while its content is collapsed. */
export default function ScoreDetailSection({ title, description, icon: Icon, defaultExpanded = false, attention, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-surface">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info"
      >
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">{title}</span>
          <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
          {attention && <span className="mt-1 block text-xs text-danger">{attention}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-text-secondary transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div
        id={contentId}
        aria-hidden={!expanded}
        inert={!expanded}
        className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
