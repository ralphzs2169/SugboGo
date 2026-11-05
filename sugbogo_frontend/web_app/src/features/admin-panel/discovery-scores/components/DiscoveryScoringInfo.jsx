import { useId, useState } from "react";
import { ChevronDown, Info } from "lucide-react";

/** Explain the established formula using the management SLA panel's visual language. */
export default function DiscoveryScoringInfo() {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-info/20 bg-info/5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left hover:bg-info/5 focus-visible:outline-2 focus-visible:outline-info sm:px-5"
      >
        <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-text-primary">Discovery Scoring Explained</span>
          <span className="mt-0.5 block text-xs text-text-secondary">Discovery Score = 80% Specialty Score + 20% Visibility Gap.</span>
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
          <div className="space-y-2 border-t border-info/10 px-4 py-4 text-sm leading-6 text-text-secondary sm:px-5">
        <p><strong className="font-medium text-text-primary">Specialty Score</strong> measures community-verified specialty reputation.</p>
        <p><strong className="font-medium text-text-primary">Visibility Gap</strong> measures relative recent exposure using recorded impressions, profile visits, and distinct savers.</p>
        <p className="text-xs">Freshness describes score computation. Zero recorded activity does not establish zero exposure.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
