import { Activity, Clock3, Copy, UsersRound } from "lucide-react";

import RelatedReviewRow from "./RelatedReviewRow";

import { SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";

const SIGNAL_ICONS = {
  duplicate_content: Copy,
  rapid_submission: Clock3,
  shared_installation_accounts: UsersRound,
};

function mergeRelatedReviews(referencedReviews = [], currentReviews = []) {
  const merged = new Map();

  referencedReviews.forEach((review) => {
    merged.set(review.id, {
      ...review,
      referencedAtDetection: true,
      currentMatch: false,
    });
  });

  currentReviews.forEach((review) => {
    const existing = merged.get(review.id);

    merged.set(review.id, {
      ...existing,
      ...review,
      referencedAtDetection: existing?.referencedAtDetection ?? false,
      currentMatch: true,
    });
  });

  return Array.from(merged.values());
}

function EmptyMessage({ children }) {
  return <p className="px-4 py-5 text-sm text-text-secondary">{children}</p>;
}

function SignalActivity({ reason, related, referencedReviews }) {
  const Icon = SIGNAL_ICONS[reason] ?? Activity;
  const isAccountSignal = reason === "shared_installation_accounts";
  const hasBaseline = reason === "duplicate_content";

  const reviews = mergeRelatedReviews(
    hasBaseline ? referencedReviews : [],
    related?.reviews ?? [],
  );

  const windowUnavailable = Boolean(related?.window_unavailable);

  let subtitle = null;
  let count = null;

  if (isAccountSignal && related?.distinct_account_count !== undefined) {
    count = related.distinct_account_count;
    subtitle = `${count === 1 ? "account" : "accounts"} currently retained`;
  } else if (!isAccountSignal && !windowUnavailable) {
    count = reviews.length;
    subtitle = `related ${count === 1 ? "review" : "reviews"} available`;
  }

  return (
    <article className="overflow-hidden rounded-lg border border-stroke bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stroke bg-background text-text-secondary">
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-text-primary">
              {SIGNAL_LABELS[reason]}
            </h4>

            {subtitle && (
              <p className="mt-0.5 text-xs text-text-secondary">
                <span className="font-semibold tabular-nums text-text-primary">
                  {count}
                </span>{" "}
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="border-t border-stroke">
        {windowUnavailable ? (
          <EmptyMessage>
            Current matches cannot be scoped to the original detection window
            because the detection time is unavailable.
          </EmptyMessage>
        ) : reviews.length > 0 ? (
          <div className="divide-y divide-stroke">
            {reviews.map((item) => (
              <RelatedReviewRow
                key={item.id}
                review={item}
                hasBaseline={hasBaseline}
                reason={reason}
              />
            ))}
          </div>
        ) : (
          <EmptyMessage>
            No related records are currently available.
          </EmptyMessage>
        )}
      </div>
    </article>
  );
}

function CurrentActivity({ review }) {
  const activity = review.current_related_activity ?? {};
  const referencedReviews = activity.referenced_reviews ?? [];

  return (
    <section
      aria-label="Current related activity"
      className="border-t border-stroke pt-6"
    >
      <div className="flex items-center gap-2">
        <Activity
          className="h-4 w-4 text-text-secondary"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        <h3 className="text-base font-semibold text-text-primary">
          Current Related Activity
        </h3>
      </div>

      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
        Live records available now. They may differ from the detection-time
        evidence if reviews were edited or deleted later.
      </p>

      <div className="mt-5 space-y-4">
        {[...new Set(review.reasons)].map((reason) => (
          <SignalActivity
            key={reason}
            reason={reason}
            related={activity[reason]}
            referencedReviews={
              reason === "duplicate_content" ? referencedReviews : []
            }
          />
        ))}
      </div>
    </section>
  );
}

export default CurrentActivity;
