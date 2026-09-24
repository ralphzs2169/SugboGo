import { useState } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { queueReviewInsightsRefresh } from "../../services/businessService";

const SENTIMENTS = [
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "negative", label: "Negative" },
];

const percentageFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function freshnessLabel(value) {
  return value ? formatDateTime(value) : "Not processed yet";
}

/**
 * Displays stored business review sentiment and frequent mentions, and queues
 * an administrator-confirmed refresh without replacing the visible insights.
 */
export default function ReviewInsightsCard({ businessId, insights }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);

  function closeConfirmation() {
    if (!isQueuing) {
      setIsConfirmOpen(false);
    }
  }

  async function confirmRefresh() {
    if (isQueuing) {
      return;
    }

    setIsQueuing(true);

    try {
      const response = await queueReviewInsightsRefresh(businessId);
      setIsConfirmOpen(false);
      toast.success(
        response.message || "Review insights refresh has been queued.",
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to queue the review insights refresh. Please try again.",
      );
    } finally {
      setIsQueuing(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Card heading */}
      <div className="border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Review Insights
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          See what explorers are saying about this business.
        </p>
      </div>

      <div className="p-5">
        {insights ? (
          <>
            {/* Sentiment distribution */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Sentiment
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {SENTIMENTS.map(({ key, label }) => {
                  const value = insights.sentiment[key];

                  return (
                    <div
                      key={key}
                      className="min-w-0 rounded-lg border border-stroke bg-surface p-4"
                    >
                      <p className="text-sm font-medium text-text-secondary">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
                        {percentageFormatter.format(value.percentage)}%
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {value.count} {value.count === 1 ? "review" : "reviews"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Frequent mentions */}
            <div className="mt-5 border-t border-stroke pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Frequently Mentioned
              </h3>
              {insights.frequent_mentions.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {insights.frequent_mentions.map((mention) => (
                    <li
                      key={mention.label}
                      className="max-w-full break-words rounded-full border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
                    >
                      {mention.label} · {mention.count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-secondary">
                  No frequent mentions yet.
                </p>
              )}
            </div>
          </>
        ) : (
          /* No stored summary yet */
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-text-primary">
              No review insights yet
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Review insights will appear after eligible reviews are processed.
            </p>
          </div>
        )}

        {/* Independent freshness and refresh action */}
        <div className="mt-5 border-t border-stroke pt-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-text-secondary">Sentiment updated</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {freshnessLabel(insights?.sentiment_computed_at)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-text-secondary">Mentions updated</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {freshnessLabel(insights?.keywords_processed_at)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              icon={RefreshCw}
              onClick={() => setIsConfirmOpen(true)}
              loading={isQueuing}
            >
              Refresh Review Insights
            </Button>
          </div>
        </div>
      </div>

      {/* Queue confirmation */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={closeConfirmation}
        title="Refresh Review Insights?"
        description="This will update sentiment counts and frequent mentions using the latest eligible reviews."
        showCloseButton={!isQueuing}
      >
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={closeConfirmation}
            disabled={isQueuing}
          >
            Cancel
          </Button>
          <Button type="button" onClick={confirmRefresh} loading={isQueuing}>
            Refresh
          </Button>
        </div>
      </Modal>
    </section>
  );
}
