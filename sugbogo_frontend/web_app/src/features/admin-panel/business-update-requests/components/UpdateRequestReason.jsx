import { MessageSquareText, Quote } from "lucide-react";

/**
 * Displays the merchant's submitted change-request explanation.
 *
 * Uses a neutral heading and the original brand-accented quotation
 * treatment consistently across Admin change-request reviews.
 */
export default function UpdateRequestReason({ reason }) {
  return (
    <div>
      {/* Reason heading */}
      <div className="flex items-center gap-2 text-text-secondary">
        <MessageSquareText size={15} aria-hidden="true" />

        <h3 className="text-xs font-bold uppercase tracking-wider">
          Reason for Change
        </h3>
      </div>

      {/* Merchant explanation */}
      <p className="mt-5 text-xs font-medium text-text-secondary">
        Merchant's explanation
      </p>

      <blockquote className="mt-2 flex overflow-hidden rounded-lg bg-surface">
        {/* Brand accent */}
        <div className="w-1 shrink-0 bg-primary" aria-hidden="true" />

        {/* Explanation content */}
        <div className="min-w-0 flex-1 px-4 py-4">
          <Quote size={18} className="text-text-secondary" aria-hidden="true" />

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {reason?.trim() || "No explanation provided."}
          </p>
        </div>
      </blockquote>
    </div>
  );
}
