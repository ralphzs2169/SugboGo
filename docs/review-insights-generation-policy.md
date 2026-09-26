# Review insights generation policy

This policy governs the stored Vibe Summary narrative, keyword tags, and
sentiment breakdown for each business.

## Eligibility and window

- Each run uses a rolling 30-day window ending at one fixed reference time.
- Review creation time controls window membership; editing a review does not
  move it back into the window.
- Published reviews are eligible unless they are spam-flagged or
  device-abuse-flagged. Sentiment outliers remain eligible.
- Blank review text does not count toward narrative generation.
- At least five eligible, nonblank reviews are required. Below that threshold,
  the stored state is `insufficient_reviews`; the window is not widened and an
  older result is not presented as current.

## Analysis limits and counts

- Up to 100 reviews per business are sent to Gemini in one generation run.
- If a business has more than 100 eligible reviews, the service selects a
  deterministic sample spread across the ordered 30-day period.
- `eligible_review_count` describes every eligible nonblank review in the
  window. `analyzed_review_count` describes only the reviews sent to Gemini.
- Keyword counts describe analyzed reviews only and are never extrapolated.
- Sentiment counts and percentages use all eligible classified reviews in the
  same 30-day window, independently of the Gemini sample.

## Generated content and evidence

- One Gemini request produces both the narrative and keyword tags from the
  same selected reviews.
- The narrative is English, contains at most two sentences and 60 words, and
  may preserve meaningful Cebuano or Filipino terms.
- Every narrative must cite valid selected review IDs.
- A keyword or theme requires support from at least two distinct selected
  reviews. At most 20 tags are stored.
- Provider-supplied counts are verified against distinct supporting review IDs
  before publication.

## Refresh, concurrency, and failures

- The scheduled batch starts daily at 03:00 UTC and processes businesses
  sequentially.
- A fingerprint of the complete eligible snapshot detects additions, edits,
  deletions, moderation changes, and reviews aging out. Unchanged snapshots
  skip Gemini.
- A PostgreSQL advisory lock prevents duplicate provider requests for the same
  business.
- Narrative, tags, evidence, coverage, counts, state, and timestamps publish in
  one database transaction after the source snapshot is rechecked.
- Transient provider failures use the existing bounded Celery retry policy.
- A previous successful result may be retained with its original timestamps
  and marked `outdated` only while all supporting reviews remain eligible.
- If any supporting review is deleted, rejected, spam-flagged, or
  device-abuse-flagged, the derived narrative and tags become unavailable until
  a valid replacement is generated.
