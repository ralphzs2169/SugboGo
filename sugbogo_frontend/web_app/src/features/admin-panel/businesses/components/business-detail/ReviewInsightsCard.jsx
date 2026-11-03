import { useEffect, useRef, useState } from "react";
import { ChartNoAxesCombined, FileSearch, RefreshCw, Star } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import StatusBadge from "@/shared/components/StatusBadge";
import { getSessionGeneration } from "@/shared/api/storage";
import { queueReviewInsightsRefresh } from "../../services/businessService";
import {
  formatBusinessDateTime,
  hasReadyBusinessRating,
} from "../../utils/businessDetailPresentation";

const WORK_LABELS = {
  scheduled: "Scheduled for processing",
  processing: "Processing recent-review insights",
  retry_wait: "Processing will retry after a delay",
};

/** Show one authoritative rating and gated recent-review content, observing reconciliation after refresh. */
export default function ReviewInsightsCard({
  business,
  syncState = "idle",
  onObserve,
  requestRefresh = queueReviewInsightsRefresh,
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [requested, setRequested] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const rating = business.sentiment_rating;
  const insights = business.review_insights;
  const work = business.review_insight_regeneration;
  const ready =
    business.sentiment_rating_enabled && hasReadyBusinessRating(rating);
  const available = insights?.content_available === true;
  const mentions = available ? (insights.frequent_mentions ?? []) : [];
  const pending = work?.is_outstanding || insights?.state === "pending";
  const outdated = insights?.state === "outdated";
  const insufficient =
    insights?.state === "insufficient_reviews" && !available && !pending;
  const canRefresh = insights?.state !== "insufficient_reviews";
  const ratingCount = rating?.contributing_review_count;
  let ratingMessage = "Rating unavailable";
  if (business.sentiment_rating_enabled === false)
    ratingMessage = "AI-derived rating is not enabled";
  else if (rating?.state === "insufficient_data")
    ratingMessage = "Not enough scored reviews";
  else if (rating?.state === "pending") {
    ratingMessage = rating.automatic_updates_enabled
      ? "Rating updating…"
      : "Awaiting rating recalculation";
  }

  function closeConfirmation() {
    if (!submitting.current) setIsConfirmOpen(false);
  }
  async function confirmRefresh() {
    if (submitting.current) return;
    submitting.current = true;
    setIsQueuing(true);
    setRefreshError(null);
    const generation = getSessionGeneration();
    try {
      const response = await requestRefresh(business.id);
      if (!mounted.current || generation !== getSessionGeneration()) return;
      setIsConfirmOpen(false);
      setRequested(true);
      toast.success(
        response.message || "Review insight reconciliation requested.",
      );
      onObserve();
    } catch (error) {
      if (!mounted.current || generation !== getSessionGeneration()) return;
      const message =
        error.response?.data?.message ||
        "Unable to request review insight refresh. Please try again.";
      setRefreshError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
      if (mounted.current && generation === getSessionGeneration())
        setIsQueuing(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-stroke bg-background"
      aria-labelledby="business-review-insights"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stroke bg-metric-header px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-60 items-start gap-2">
          <ChartNoAxesCombined
            aria-hidden="true"
            className="mt-1 h-4 w-4 shrink-0 text-text-primary"
          />
          <div className="min-w-0">
            <h2
              id="business-review-insights"
              className="text-base font-semibold text-text-primary"
            >
              Review Insights
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              AI-assisted interpretation of published reviews.
            </p>
          </div>
        </div>
        {canRefresh && (
          <Button
            icon={RefreshCw}
            onClick={() => setIsConfirmOpen(true)}
            loading={isQueuing}
          >
            Refresh Review Insights
          </Button>
        )}
      </header>
      <div className="p-5 sm:p-6">
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-6">
          {/* All-time authoritative rating */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                AI-derived rating
              </h3>
            </div>
            {ready ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p
                    className="text-4xl font-bold tracking-tight text-text-primary"
                    aria-label={
                      "AI-derived rating " + rating.value.toFixed(1) + " out of 5"
                    }
                  >
                    {rating.value.toFixed(1)}{" "}
                    <span className="text-xl font-medium text-text-secondary">
                      / 5
                    </span>
                  </p>
                  <div
                    className="relative mt-2 inline-flex text-text-secondary/30"
                    aria-hidden="true"
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={18} />
                    ))}
                    <div
                      className="absolute inset-0 flex overflow-hidden text-warning"
                      style={{ width: (rating.value / 5) * 100 + "%" }}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          fill="currentColor"
                          className="shrink-0"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-text-secondary">
                  <p>Based on {ratingCount} scored reviews · All time</p>
                  <p className="mt-1 text-xs">
                    Calculated {formatBusinessDateTime(rating.computed_at)} · PHT
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 text-sm text-text-secondary" role="status">
                <p className="font-medium">{ratingMessage}</p>
                {business.sentiment_rating_enabled &&
                  rating?.state === "insufficient_data" && (
                    <p className="mt-1 text-xs">
                      {Number.isInteger(ratingCount)
                        ? ratingCount + " of 5 required"
                        : "At least 5 qualifying scored reviews are required."}
                    </p>
                  )}
              </div>
            )}
          </div>

          <div className="min-w-0 border-t border-stroke pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {insufficient ? (
              <div className="flex h-full items-center gap-4 py-2" role="status">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
                  <FileSearch
                    aria-hidden="true"
                    className="h-7 w-7 text-text-secondary"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">
                    Not enough recent reviews for insights
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Review insights and frequently mentioned themes become available
                    {Number.isInteger(insights.minimum_eligible_review_count)
                      ? ` after at least ${insights.minimum_eligible_review_count} eligible recent reviews.`
                      : " after the required number of eligible recent reviews."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Recent-review insights
                  </h3>
                  {outdated && (
                    <StatusBadge variant="warningSoft">Outdated</StatusBadge>
                  )}
                </div>
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 text-sm text-text-secondary"
                >
                  {pending
                    ? WORK_LABELS[work?.status] ||
                      "Recent-review insights are being processed."
                    : insights?.state !== "ready" && insights?.state_message}
                  {outdated && available && (
                    <p>
                      Showing the last available content while newer insights are
                      pending.
                    </p>
                  )}
                </div>
                {available && insights.narrative && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                    {insights.narrative}
                  </p>
                )}
                {!available && !pending && !insights?.state_message && (
                  <p className="mt-3 text-sm text-text-secondary">
                    Recent-review insights are not available yet.
                  </p>
                )}
                <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Frequently mentioned
                </h4>
                {mentions.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {mentions.map((mention) => (
                      <li
                        key={mention.label}
                        className="max-w-full break-words rounded-full border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
                      >
                        {mention.label} · {mention.count}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-text-secondary">
                    {available && insights.state === "ready" && !pending
                      ? "No recurring themes were found in the analyzed reviews."
                      : "Themes will appear when eligible review insights are available."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {insights && (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stroke pt-4 text-xs leading-relaxed text-text-secondary sm:mt-6">
            {insights.coverage_start && insights.coverage_end && (
              <p>
                Review window:{" "}
                {formatBusinessDateTime(insights.coverage_start)} –{" "}
                {formatBusinessDateTime(insights.coverage_end)} · PHT
              </p>
            )}
            {available && (
              <p className="sm:border-l sm:border-stroke sm:pl-5">
                {insights.analyzed_review_count} of{" "}
                {insights.eligible_review_count} eligible reviews analyzed
                {insights.is_sampled ? " · Sampled" : ""}
              </p>
            )}
            {!available && Number.isInteger(insights.eligible_review_count) && (
              <p className="sm:border-l sm:border-stroke sm:pl-5">
                Current eligible reviews: {insights.eligible_review_count}
              </p>
            )}
            {!insufficient && insights.generated_at && (
              <p className="sm:border-l sm:border-stroke sm:pl-5">
                Last generated {formatBusinessDateTime(insights.generated_at)}{" "}
                · PHT
              </p>
            )}
          </div>
        )}

        {/* Reconciliation observation and request action */}
        {(requested || syncState !== "idle" || refreshError) && (
          <div className="mt-4 border-t border-stroke pt-4">
            <div
              role="status"
              aria-live="polite"
              className="text-xs text-text-secondary"
            >
              {requested && syncState !== "complete" && (
                <p>Reconciliation requested; observing processing state.</p>
              )}
              {syncState === "complete" && <p>Processing check complete.</p>}
              {(syncState === "error" || syncState === "paused") && (
                <p>
                  Automatic checks{" "}
                  {syncState === "paused" ? "paused" : "could not complete"}.{" "}
                  <button
                    type="button"
                    onClick={onObserve}
                    className="cursor-pointer font-semibold text-primary hover:underline"
                  >
                    Check for updates
                  </button>
                </p>
              )}
              {refreshError && (
                <p role="alert" className="text-danger">
                  {refreshError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <Modal
        isOpen={isConfirmOpen}
        onClose={closeConfirmation}
        title="Refresh Review Insights?"
        description="Request reconciliation of recent-review summaries and themes. This does not directly refresh the all-time rating."
        showCloseButton={!isQueuing}
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            onClick={closeConfirmation}
            disabled={isQueuing}
          >
            Cancel
          </Button>
          <Button onClick={confirmRefresh} loading={isQueuing}>
            Request refresh
          </Button>
        </div>
      </Modal>
    </section>
  );
}
