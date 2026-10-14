import { useId, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Files,
  History,
} from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";
import {
  BASIS_LABELS,
  SIGNAL_LABELS,
} from "../utils/suspiciousReviewPresentation";

function detectionContext(item) {
  if (item.detected_during === "edit") {
    return "Detected during review edit";
  }

  if (
    item.detected_during === "creation" ||
    item.detected_during === "submission"
  ) {
    return "Detected during review submission";
  }

  // Creation snapshots predate this field; edit snapshots always record "edit".
  if (
    !item.detected_during &&
    item.observed_at &&
    !Number.isNaN(Date.parse(item.observed_at))
  ) {
    return "Detected during review submission";
  }

  return "Detection stage not recorded";
}

function EvidenceMetric({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>

      <dd className="mt-0.5 text-sm font-semibold text-text-primary">
        {value}
      </dd>
    </div>
  );
}

function MatchingReviews({ reviews }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  if (!reviews?.length) {
    return null;
  }

  function handleViewReview(reviewId) {
    const target = document.getElementById(`related-review-${reviewId}`);

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Give the scroll time to settle, then focus the destination
    // without triggering a second jump.
    window.setTimeout(() => {
      target.focus({
        preventScroll: true,
      });
    }, 450);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="
          group flex w-full items-center justify-between gap-3
          rounded-md px-1 py-1.5 text-left
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <span className="flex min-w-0 items-center gap-2">
          <Files
            className="h-3.5 w-3.5 shrink-0 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary">
            Detection-time matching reviews
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-text-secondary">
            {reviews.length}
          </span>

          <ChevronDown
            className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div
          id={contentId}
          className="mt-2 overflow-hidden rounded-lg border border-warning/20 bg-background/70"
        >
          <div className="divide-y divide-stroke">
            {reviews.map((match) =>
              match.available ? (
                <div
                  key={match.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-text-primary">
                    Review #{match.id}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleViewReview(match.id)}
                    aria-label={`View review #${match.id} in current related activity`}
                    className="
                      shrink-0 rounded-sm text-xs font-medium text-primary
                      hover:underline
                      focus-visible:outline focus-visible:outline-2
                      focus-visible:outline-offset-2 focus-visible:outline-primary
                    "
                  >
                    View review
                  </button>
                </div>
              ) : (
                <div
                  key={match.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="text-sm text-text-secondary">
                    Review #{match.id}
                  </span>

                  <span className="shrink-0 text-xs text-text-secondary">
                    Unavailable
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetectionEvidence({ review }) {
  const evidence = review.detection_evidence ?? {};

  return (
    <section
      aria-label="Suspicious activity evidence"
      className="border-t border-stroke pt-5"
    >
      <div className="flex items-center gap-2">
        <History
          className="h-4 w-4 text-text-secondary"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        <h3 className="text-base font-semibold text-text-primary">
          Why This Review Was Flagged
        </h3>
      </div>

      <p className="mt-1 text-sm text-text-secondary">
        Stored evidence from when each suspicious activity signal was detected.
      </p>

      <div className="mt-4 space-y-3">
        {review.reasons.map((reason) => {
          const item = evidence[reason];

          return (
            <article
              key={reason}
              className={`rounded-lg border p-4 ${
                item
                  ? "border-warning/30 bg-warning/10"
                  : "border-stroke bg-surface-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                {item ? (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                ) : (
                  <CircleHelp
                    className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {SIGNAL_LABELS[reason]}
                    </h4>

                    {item && (
                      <span className="shrink-0 rounded-md border border-warning/20 bg-background/60 px-2 py-1 text-xs font-medium text-text-secondary">
                        {detectionContext(item)}
                      </span>
                    )}
                  </div>

                  {!item ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Detection-time details were not recorded for this
                      historical review.
                    </p>
                  ) : (
                    <>
                      {reason === "duplicate_content" && (
                        <div className="mt-2">
                          <p className="text-xs text-text-secondary">
                            The same normalized review text was detected in
                            previous reviews.
                          </p>

                          <dl className="mt-3 grid grid-cols-2 gap-4">
                            <EvidenceMetric
                              label="Prior matches"
                              value={item.prior_match_count ?? 0}
                            />

                            <EvidenceMetric
                              label="Matched by"
                              value={
                                BASIS_LABELS[item.basis] ??
                                "Same user or installation"
                              }
                            />
                          </dl>

                          <MatchingReviews reviews={item.matched_reviews} />
                        </div>
                      )}

                      {reason === "rapid_submission" && (
                        <div className="mt-2">
                          <p className="text-xs text-text-secondary">
                            Multiple reviews were submitted using the same app
                            installation identifier within a short period.
                          </p>

                          <dl className="mt-3 grid grid-cols-2 gap-4">
                            <EvidenceMetric
                              label="Reviews detected"
                              value={item.review_count ?? 0}
                            />

                            <EvidenceMetric
                              label="Time window"
                              value={`${item.window_hours ?? 0} hours`}
                            />
                          </dl>
                        </div>
                      )}

                      {reason === "shared_installation_accounts" && (
                        <div className="mt-2">
                          <p className="text-xs text-text-secondary">
                            Multiple accounts using the same app installation
                            identifier reviewed this business.
                          </p>

                          <dl className="mt-3">
                            <EvidenceMetric
                              label="Distinct accounts"
                              value={item.distinct_account_count ?? 0}
                            />
                          </dl>
                        </div>
                      )}

                      {item.observed_at &&
                        !Number.isNaN(Date.parse(item.observed_at)) && (
                          <div className="mt-4 border-t border-warning/20 pt-3">
                            <p className="text-xs text-text-secondary">
                              Observed{" "}
                              <time dateTime={item.observed_at}>
                                {formatDateTime(item.observed_at)}
                              </time>
                            </p>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default DetectionEvidence;
