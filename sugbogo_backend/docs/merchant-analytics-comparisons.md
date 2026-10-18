# Merchant KPI comparisons

The Plus review-performance endpoint adds `published_review_count_change`
(`value`, `direction`, `unit: "count"`, nullable `reason`). This is an absolute
difference between equal elapsed-duration creation cohorts still published at
the report cutoff. Empty cohorts are valid counts; no denominator is needed.
These are current retained records, not publication-transition history or
immutable historical snapshots. Reply changes remain percentage points.

The individual visibility, Pocket and review-performance endpoints accept an
optional `as_of` timestamp no more than five minutes behind the server clock.
Mobile uses Standard's `meta.generated_at` so both reports have identical partial
period boundaries. This does not restore historical moderation/deletion state.
Old or future cutoffs are rejected. Standard remains independent of Plus.
Query keys include the account, period, interval and optional cutoff.
The primary chart keeps ordinary, independent reporting requests so interval
changes do not depend on an expired comparison cutoff. Its cache is observed
without a second request; an aligned visibility comparison is requested only
after that report explicitly approves coverage. Pocket and review comparisons
use individual endpoints, never the combined report. If a comparison cutoff
expires while the screen remains open, pull-to-refresh obtains a fresh one;
the Standard values and primary chart remain usable.

## Visibility eligibility is intentionally closed

`VisibilityCoverageService.assess()` currently returns `eligible: false`.
Event metrics expose its `comparison_eligibility`, and `change.value` remains
null with `coverage_unverified`. There is no setting or automatic success-count
threshold that can enable it. In particular, existing seeded observations,
the first observed event, missing days, a healthy Mongo connection and successful
requests are not evidence of complete coverage.

Ingestion emits `visibility_tracking` structured operational log records under
`apps.business.services.visibility_coverage_service`: server observation time,
event time/type, business scope, definition version, accepted insert/duplicate
counts, or failure/cooldown reason. Explorer/account IDs and request content are
not logged. Owner exclusions do not produce receipt traffic. Monitoring failures
do not change event write behavior. Bulk write-concern failures are now treated
as unavailable even when the write-error list contains only duplicate keys.

**These logs are a monitoring foundation, not a durable coverage ledger.**
Deployment must configure an appropriate log handler/sink and retention; this
change does not assume one exists. A failed log sink, process crash, unseen
client request or dropped post-commit callback cannot be reconstructed from logs.
The Mongo and PostgreSQL operations remain non-atomic. No past coverage is
backfilled and no new collections, migrations or jobs are introduced.

Before eligibility can become positive, an authoritative, durable evidence
producer must demonstrate all of the following for both exact windows:

- Instrumentation rollout/version coverage and acknowledged client delivery,
  including observations that never reached the server.
- Complete ingestion/persistence accounting and known outage/gap reconciliation,
  including SAVE after PostgreSQL commit; absence of failures alone is insufficient.
- Stable account/business eligibility, owner exclusions and the same UTC-day
  deduplication definition, with reporting boundaries in Asia/Manila.
- Synthetic provenance/exclusion covering demo data, direct writes and cleanup.
- Evidence retention and completeness through the reporting cutoff; missing or
  incomplete evidence must fail closed, including partial current periods.

That delivery/persistence architecture is outside this focused change and must
be designed separately. Merely letting more time pass with current best-effort
tracking will not make history verified. The approved-percentage calculation
path is wired and tested with explicit simulated coverage approval; those tests
are not evidence that live tracking is verified.

Mobile accepts only explicit backend changes with matching business, exact
effective boundaries, totals/cohorts, source availability, units and direction.
Zero changes read "No change". Prior zero counts suppress percentage growth;
absolute review differences remain defined. Plus failures/revocation hide
unsupported badges while preserving Standard cards. Pull-to-refresh obtains
a fresh Standard cutoff, then refreshes active permitted reports.

## Changed files

Backend implementation:

- `apps/shared/analytics/comparisons.py`: equal-window validation and signed count comparisons.
- `apps/business/services/visibility_coverage_service.py`: operational monitoring and closed coverage gate.
- `apps/business/services/visibility_event_service.py`: ingestion receipts and write-concern failure handling.
- `apps/merchant_operations/merchant_analytics/services/premium_review_performance_service.py`: review-count comparison.
- `apps/merchant_operations/merchant_analytics/services/premium_visibility_service.py`: coverage-gated percentages and evidence metadata.
- `apps/merchant_operations/merchant_analytics/serializers/premium_analytics_serializers.py`: additive response fields and bounded cutoff input.
- `apps/merchant_operations/merchant_analytics/views/premium_analytics_views.py`: optional cutoff validation for individual reports.

Mobile implementation (relative to `sugbogo_frontend/mobile`):

- `src/features/merchant/components/analytics/AnalyticsActivityOverview.tsx`: conditional KPI badges, preserving styling.
- `src/features/merchant/screens/merchant-mode/MerchantAnalyticsScreen.tsx`: entitled individual queries and chart-cache observation.
- `src/features/merchant/hooks/analytics/merchantPlusAnalyticsQueryKeys.ts`: cutoff-scoped cache keys.
- `src/features/merchant/types/merchantPlusAnalytics.types.ts`: additive typed contracts.
- `src/features/merchant/utils/merchantKpiComparisons.utils.ts`: comparison matching, validation and formatting.

Backend regression tests:

- `apps/shared/analytics/tests/test_kpi_comparisons.py`
- `apps/business/services/tests/test_visibility_coverage_service.py`
- `apps/merchant_operations/merchant_analytics/services/tests/test_premium_review_services.py`
- `apps/merchant_operations/merchant_analytics/services/tests/test_premium_visibility_service.py`
- `apps/merchant_operations/merchant_analytics/views/tests/test_premium_analytics_views.py`

Mobile regression tests:

- `src/features/merchant/utils/__tests__/merchantKpiComparisons.utils.test.ts`
- `src/features/merchant/screens/merchant-mode/__tests__/MerchantAnalyticsScreen.test.tsx`
- `src/features/merchant/hooks/analytics/__tests__/useMerchantPlusAnalytics.test.tsx` (wait for asynchronous cache purge).

No migrations, new collections, dependencies, historical cleanup or production data changes.
