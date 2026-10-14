import { MessageSquareText } from "lucide-react";

import { formatLabel } from "@/shared/utils/stringUtils";

export default function ReviewDisputeRequest({ dispute }) {
  return (
    <section aria-label="Dispute request">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <MessageSquareText
          className="h-4 w-4 text-text-secondary"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        <h2 className="text-base font-semibold text-text-primary">
          Dispute Request
        </h2>
      </div>

      <div className="mt-4 space-y-4">
        {/* Dispute reason */}
        <div>
          <p className="text-xs font-medium text-text-secondary">Reason</p>

          <p className="mt-1.5 text-sm font-semibold text-text-primary">
            {formatLabel(dispute.reason)}
          </p>
        </div>

        {/* Merchant explanation */}
        <div>
          <p className="text-xs font-medium text-text-secondary">
            Merchant Explanation
          </p>

          <div className="mt-2 rounded-lg border border-stroke bg-surface-muted/40 px-4 py-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
              {dispute.description || "No explanation provided."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
