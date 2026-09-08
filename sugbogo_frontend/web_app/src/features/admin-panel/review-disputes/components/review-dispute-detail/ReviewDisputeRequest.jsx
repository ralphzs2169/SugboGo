import { MessageSquareText, Tag } from "lucide-react";
import { formatLabel } from "@/shared/utils/stringUtils";
/**
 * Displays the merchant's submitted dispute reason and explanation
 * as a concise moderation case submission.
 */
export default function ReviewDisputeRequest({ dispute }) {
  return (
    <div>
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <MessageSquareText
          className="h-3.5 w-3.5 text-text-secondary"
          strokeWidth={2}
        />

        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Dispute Request
        </h2>
      </div>

      {/* Request details */}
      <div className="mt-5 space-y-5">
        {/* Dispute reason */}
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-text-secondary">Reason</p>
          </div>

          <div className="mt-2 ">
            <span className="text-sm font-semibold capitalize text-text-primary">
              {formatLabel(dispute.reason)}
            </span>
          </div>
        </div>

        {/* Merchant explanation */}
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-text-secondary">
              Merchant Explanation
            </p>
          </div>

          <div className="mt-2 rounded-lg border border-stroke bg-surface-secondary/50 px-4 py-3.5">
            <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">
              {dispute.description || "No explanation provided."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
