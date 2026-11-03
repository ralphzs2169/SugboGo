import {
  REVIEW_HISTORY_LABELS,
  REVIEW_STATUSES,
  reviewAuthorName,
} from "../utils/allReviewPresentation";
import ReviewDate from "./ReviewDate";

/** Present only recorded AdminActivity decisions, retaining their server chronology. */
export default function AllReviewHistory({ history = [] }) {
  return (
    <section
      aria-label="Review decision history"
      className="border-t border-stroke pt-5"
    >
      <h3 className="text-base font-semibold text-text-primary">
        Decision history
      </h3>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          No administrative decisions are recorded.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-text-secondary">Most recent first</p>
          <ol className="mt-4 divide-y divide-stroke border-t border-stroke">
            {history.map((event) => (
              <li key={event.id} className="space-y-2 py-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {REVIEW_HISTORY_LABELS[event.action] ||
                        "Administrative decision"}
                    </h4>
                    <p className="mt-1 break-words text-xs text-text-secondary">
                      {event.actor
                        ? reviewAuthorName(event.actor)
                        : "Administrator"}
                    </p>
                  </div>
                  <ReviewDate value={event.created_at} />
                </div>
                {(event.previous_review_status || event.review_status) && (
                  <p className="text-xs text-text-secondary">
                    {REVIEW_STATUSES[event.previous_review_status]?.label ||
                      "Previous status not recorded"}
                    {" → "}
                    {REVIEW_STATUSES[event.review_status]?.label ||
                      "Resulting status not recorded"}
                  </p>
                )}
                {event.notes && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                    {event.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
