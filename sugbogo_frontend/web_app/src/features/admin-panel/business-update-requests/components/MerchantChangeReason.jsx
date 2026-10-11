import { FilePenLine, Quote } from "lucide-react";

/**
 * Displays a merchant's submitted change justification.
 *
 * Uses the same section heading, accent stripe, and quotation styling as
 * the mobile change-request review experience.
 */
export default function MerchantChangeReason({ reason }) {
  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section heading */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Reason for change
        </h2>

        <FilePenLine
          size={18}
          className="text-text-secondary"
          aria-hidden="true"
        />
      </div>

      {/* Merchant explanation */}
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Merchant's explanation
        </p>

        <blockquote className="mt-3 flex overflow-hidden rounded-xl bg-surface">
          {/* Brand accent */}
          <div className="w-1 shrink-0 bg-primary" aria-hidden="true" />

          {/* Quoted explanation */}
          <div className="min-w-0 flex-1 px-4 py-4">
            <Quote
              size={19}
              className="text-text-secondary"
              aria-hidden="true"
            />

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
              {reason?.trim() || "No explanation provided."}
            </p>
          </div>
        </blockquote>
      </div>
    </section>
  );
}
