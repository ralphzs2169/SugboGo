# Review performance vibe labels

`GET /api/merchant/analytics/premium/review-performance/` includes nullable
`current.overall_vibe` and `previous.overall_vibe` fields. Values are
`mostly_positive`, `mostly_neutral`, `mostly_negative`, `mixed`, or `null`.

Each label describes the same selected or previous creation cohort as that
object's review counts: reviews created within its reporting window that are
still published at the reporting cutoff. It does not use the Explorer stored
summary's separate rolling 30-day window.

The shared classifier preserves the existing stored-summary definition:

- The categorized count must meet the current policy's
  `sentiment_min_classified_reviews`; otherwise the label is `null`.
- A category is dominant when its unrounded share is at least 55% and leads
  the next category by at least 15 percentage points.
- Sufficient samples without a dominant category are `mixed`.
- Uncategorized reviews are not included in the category denominator.

The classifier is shared by `BusinessReviewSummary.overall_vibe` and
`PremiumReviewPerformanceService.cohort`. Existing aggregation, eligibility,
periods, access checks, and comparisons are unchanged. Weekly series do not
include a vibe field. No schema migration, generation job, or stored-data update
is required.

Mobile treats the new field as optional for compatibility with older API
responses and caches. It renders the supplied label only when the same report
permits categorized-feedback presentation; it does not derive a label locally
or request Explorer insights to fill a missing value.

Focused checks without database setup:

```powershell
.\.venv\Scripts\python.exe -B manage.py test apps.merchant_operations.merchant_analytics.services.tests.test_review_vibe_reporting --noinput
```

These tests use unsaved model instances and mocked cohort query results, and
cover existing thresholds, policy changes, 7/30/90-day query windows, null
labels, and response serialization. Physical mobile rendering and a running
backend response remain useful manual checks.
