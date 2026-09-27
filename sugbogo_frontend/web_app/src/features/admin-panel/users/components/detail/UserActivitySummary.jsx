import { Flag, MessageSquareText, ShieldQuestion, ThumbsUp } from "lucide-react";

import { formatLabel } from "@/shared/utils/stringUtils";

const METRIC_CONFIG = {
  reviews: { icon: MessageSquareText },
  vouches: { icon: ThumbsUp },
  reports: { icon: Flag },
  review_disputes: { icon: ShieldQuestion },
};

export default function UserActivitySummary({ summary = {} }) {
  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Activity Summary
      </h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(summary).map(([key, value]) => {
          const Icon = METRIC_CONFIG[key]?.icon ?? MessageSquareText;

          return (
            <div
              key={key}
              className="rounded-xl border border-stroke bg-background p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {formatLabel(key)}
                </p>
                <Icon
                  className="h-4 w-4 text-text-secondary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 text-2xl font-bold text-text-primary">
                {value}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
