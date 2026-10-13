import { Link } from "react-router-dom";

import { formatDateTime } from "@/shared/utils/dateUtils";
import { displayName, SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

function CurrentActivity({ review }) {
  const activity = review.current_related_activity ?? {};

  return (
    <section className="border-t border-stroke pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
        Current Related Activity
      </h3>
      <p className="mt-1 text-sm text-text-secondary">
        Live data currently available. This may differ if reviews were edited or deleted later.
      </p>
      <div className="mt-4 space-y-5">
        {activity.referenced_reviews?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-text-primary">Retained reviews referenced at detection</h4>
            <p className="mt-1 text-xs text-text-secondary">Current record details; text or status may have changed since detection.</p>
            <div className="mt-2 space-y-2">
              {activity.referenced_reviews.map((item) => (
                <details key={item.id} id={`related-review-${item.id}`} className="rounded-lg border border-stroke p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-text-primary">Review #{item.id} · {item.status}</summary>
                  <p className="mt-2 whitespace-pre-wrap text-text-primary">{item.text}</p>
                  <p className="mt-2 text-text-secondary">
                    <Link className="text-primary hover:underline" to={`/admin-panel/users/${item.author.id}`}>{displayName(item.author)}</Link>
                    {" · "}
                    <Link className="text-primary hover:underline" to={`/admin-panel/businesses/${item.business.id}`}>{item.business.name}</Link>
                    {" · "}{formatDateTime(item.submitted_at)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}
        {review.reasons.map((reason) => {
          const related = activity[reason];
          return (
            <div key={reason}>
              <h4 className="text-sm font-semibold text-text-primary">
                {SIGNAL_LABELS[reason]}
              </h4>
              {reason === "shared_installation_accounts" && related && (
                <p className="mt-1 text-xs text-text-secondary">
                  {related.distinct_account_count} distinct accounts currently retained
                </p>
              )}
              {related?.window_unavailable ? (
                <p className="mt-2 text-sm text-text-secondary">The detection time is unavailable, so current matches cannot be scoped to the original 30-day window.</p>
              ) : !related?.reviews?.length ? (
                <p className="mt-2 text-sm text-text-secondary">No related records currently available.</p>
              ) : (
                <ul className="mt-2 divide-y divide-stroke rounded-lg border border-stroke">
                  {related.reviews.map((item) => (
                    <li key={item.id} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-text-primary">Review #{item.id} · {item.status}</span>
                        <span className="text-xs text-text-secondary">{formatDateTime(item.submitted_at)}</span>
                      </div>
                      <p className="mt-1 text-text-secondary">
                        <Link className="text-primary hover:underline" to={`/admin-panel/users/${item.author.id}`}>{displayName(item.author)}</Link>
                        {" · "}
                        <Link className="text-primary hover:underline" to={`/admin-panel/businesses/${item.business.id}`}>{item.business.name}</Link>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CurrentActivity;
