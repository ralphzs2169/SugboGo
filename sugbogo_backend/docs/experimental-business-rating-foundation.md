# Experimental business rating foundation (Phase 3)

This records the original Phase 3 contract. Automatic delivery, invalidation,
recovery and the current API freshness behavior are now described in
[the Phase 4 lifecycle guide](experimental-business-rating-lifecycle.md).

## Scope and exposure

Ratings are manual development snapshots. They are not validated quality scores.
No inference, lifecycle hooks, Celery dispatch, mobile changes, or ranking changes
are introduced. EXPERIMENTAL_BUSINESS_RATINGS_ENABLED defaults to False.
When explicitly enabled, existing Explorer business-card/detail responses add a
sentiment_rating object. Recommendation and Pocket cards inherit the same field;
compact map contracts and Merchant analytics contracts are unchanged.

The object contains value (number/null), contributing_review_count (integer/null),
state, experimental (always true), provenance, scoring_version,
calculation_version, computed_at and automatic_updates_enabled (always false).
An absent row is pending with an unknown count, rather than an invented zero.
An evaluated population below five is insufficient_data with its actual count.
An unsupported calculation version is unavailable. Outstanding revisions suppress
the value as pending. A timestamp is a snapshot receipt, not proof that subsequent
review changes have been processed.

## Calculation and input contract

signed-average-v1 uses 3 + 2 * AVG(score). Count and average are computed by one
SQL aggregation after locking the business/aggregate. Only the final stored value
is quantized to ten decimals, then the API rounds half-up to one decimal. There is
no per-review rounding, Bayesian adjustment, weighting, or recent-review window.

Inputs must be published, nonblank reviews with recognized positive/neutral/negative
labels and finite scores in [-1, 1]. Advisory flags do not exclude reviews.
Database range predicates reject NULL, infinities and PostgreSQL NaN. One-to-one
result membership avoids join multiplication.

## Legacy and versioned lanes

--legacy-unverified explicitly selects legacy-unverified-v1. It reads current
Review score/label fields only where no ReviewRatingResult exists. It never
assigns historical provenance or changes historical scores. Known-version results,
even stale ones, never silently fall back to the legacy lane.

A versioned calculation selects exactly one scoring compatibility identifier.
Do not reuse an identifier after a material change in model assets, label mapping,
routing, normalization, or calibration. Version identifiers are declarations by
the producer, not evidence of validation. All versions remain experimental in this
phase. An explicit recomputation with another version replaces the business's
single snapshot; it never blends methods.

The future producer integration boundary is:

    BusinessRatingService.record_result(
        review_id=review_id,
        source_text=exact_text_analyzed,
        score=normalized_signed_score,
        label=recognized_lowercase_label,
        scoring_version=compatibility_identifier,
    )

Inference must happen outside the transaction. This method locks the review and
rejects a stale source text. It stores one latest result and does not alter legacy
Review sentiment fields. The source-text snapshot is deliberate provenance:
SQL equality excludes results after edits without changing the current scorer.
Producers maintaining existing insight/filter sentiment fields should coordinate
both writes in their owning transaction and call this method before commit.
Model revisions/hashes and validation evidence must be tied to the compatibility
identifier in the producer's controlled release manifest. This phase does not
claim independent verification of those declarations or retain result history.

## Development recalculation

Apply migration 0029 before using this foundation. It creates BUSINESS_RATING and
REVIEW_RATING_RESULT with uniqueness, score/value range, state and revision
constraints. There is no data migration or automatic backfill.

From the configured backend runtime:

    python manage.py recompute_business_ratings --legacy-unverified
    python manage.py recompute_business_ratings --legacy-unverified --business-id 12
    python manage.py recompute_business_ratings --scoring-version approved-method-v1

Business IDs can be repeated; duplicates are removed. With no IDs, all businesses
are visited in primary-key order. Repeated execution replaces each snapshot,
never adds duplicate contributions. Command output distinguishes completed states
and contributing counts from failed calculations; failures yield a nonzero exit.
Zero contributors can mean missing, invalid, stale, or differently versioned
inputs: insufficient_data does not certify that scoring is complete. The selected
scoring version is printed explicitly. Existing eligible scores are never rescored.

## Phase 4 integration

Requested/completed revision columns reserve a durable freshness boundary, but no
mutation currently increments them automatically. Before public use, Phase 4 must
wire publication, score persistence, accepted text edits, deletion, rejection and
policy/version changes to durable invalidation/recalculation, with consistent lock
order, retry/reconciliation and stale-result suppression. Current snapshots can
become obsolete until the command is rerun.

A caller-provided version is not model validation. Public exposure also requires
the separate scoring-validation work, controlled rescoring, and an explicit product
decision about experimental versus validated release. Five reviews is only a
display threshold.

