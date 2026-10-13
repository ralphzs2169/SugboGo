import { formatDateTime } from "@/shared/utils/dateUtils";
import { BASIS_LABELS, SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

function detectionContext(item) {
  if (item.detected_during === "edit") {
    return "Detected during review edit";
  }
  if (item.detected_during === "creation" || item.detected_during === "submission") {
    return "Detected during review submission";
  }
  // Creation snapshots predate this field; edit snapshots always record "edit".
  if (!item.detected_during && item.observed_at && !Number.isNaN(Date.parse(item.observed_at))) {
    return "Detected during review submission";
  }
  return "Detection stage not recorded for this historical review.";
}

function DetectionEvidence({ review }) {
  const evidence = review.detection_evidence ?? {};

  return (
    <section className="border-t border-stroke pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
        Why It Was Flagged
      </h3>
      <p className="mt-1 text-sm text-text-secondary">
        Stored evidence from when each reliability signal was first detected.
      </p>
      <div className="mt-4 space-y-4">
        {review.reasons.map((reason) => {
          const item = evidence[reason];
          return (
            <div key={reason} className="rounded-lg border border-stroke bg-surface p-4">
              <h4 className="text-sm font-semibold text-text-primary">
                {SIGNAL_LABELS[reason]}
              </h4>
              {!item ? (
                <p className="mt-2 text-sm text-text-secondary">
                  Detection-time details were not recorded for this historical review.
                </p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-text-secondary">
                  <p className="text-xs font-medium">{detectionContext(item)}</p>
                  {reason === "duplicate_content" && (
                    <>
                      <p>Same normalized review text detected.</p>
                      <p>{item.prior_match_count} prior matching reviews · {BASIS_LABELS[item.basis] ?? "Same user or installation"}</p>
                      {item.matched_reviews?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.matched_reviews.map((match) => (
                            match.available ? (
                              <a key={match.id} href={`#related-review-${match.id}`} className="rounded-md border border-stroke px-2 py-1 text-xs text-primary hover:underline">
                                View review #{match.id}
                              </a>
                            ) : (
                              <span key={match.id} className="rounded-md border border-stroke px-2 py-1 text-xs">
                                Review #{match.id} · unavailable/deleted
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {reason === "rapid_submission" && (
                    <p>{item.review_count} reviews with the same app installation identifier within {item.window_hours} hours.</p>
                  )}
                  {reason === "shared_installation_accounts" && (
                    <p>{item.distinct_account_count} distinct accounts using the same app installation identifier reviewed this business.</p>
                  )}
                  {item.observed_at && !Number.isNaN(Date.parse(item.observed_at)) && (
                    <p className="text-xs">Observed {formatDateTime(item.observed_at)}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default DetectionEvidence;
