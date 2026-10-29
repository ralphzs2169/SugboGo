import { Info } from "lucide-react";

/** Keeps methodology and exact detail keyboard-accessible through the existing native disclosure pattern. */
export default function AnalyticsDisclosure({ label = "About this report", children, inline = false, iconOnly = false, comfortable = false }) {
  return (
    <details className={inline ? "relative inline-block shrink-0" : "min-w-0"} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      {/* Named trigger and progressively disclosed context */}
      <summary aria-label={label} className={`cursor-pointer rounded text-xs font-medium text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info ${inline ? `${comfortable ? "min-h-8 min-w-8 justify-center hover:bg-surface-hover hover:text-text-primary" : "min-h-7"} inline-flex items-center gap-1.5 px-1` : "py-2"}`}>
        {inline && <Info aria-hidden="true" className={comfortable ? "h-4 w-4" : "h-3.5 w-3.5"} />}
        <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
      </summary>
      <div className={inline ? "absolute right-0 top-full z-20 mt-1 w-72 max-w-[75vw] space-y-2 rounded-lg border border-stroke bg-background p-3 text-xs leading-relaxed text-text-primary shadow-md" : "mt-2 space-y-3 rounded-lg bg-surface-muted p-3 text-sm leading-relaxed text-text-primary"}>
        {children}
      </div>
    </details>
  );
}
