# Aged unanswered reviews: backend contract and mobile integration plan

The current-backlog summary and mobile integration are implemented. The summary
contract and age definitions remain unchanged. The supplied wireframe is adapted
to SugboGo full-width sections and existing theme tokens.

## Backend contract

`GET /api/merchant/analytics/standard/unanswered-reviews/`

Route name: `merchant-analytics-aged-unanswered-reviews`.

This Standard endpoint requires an authenticated active merchant with an owned
business. It does not consult Plus entitlement. It accepts no query parameters:
business IDs, period, custom dates, and client cutoffs are rejected with HTTP 400.
Anonymous requests return 401, denied roles/inactive merchants 403, and merchants
without a business 404. Mutation methods return 405 for authorized callers.

Illustrative response shape (fixture-style values, not live business activity):

```json
{
  "success": true,
  "message": "Current unanswered review ages retrieved successfully.",
  "data": {
    "business": { "id": 1, "name": "Merchant A", "status": "active" },
    "total_unanswered": 6,
    "under_3_days": 2,
    "days_3_to_6": 2,
    "days_7_plus": 2,
    "snapshot_as_of": "2026-10-13T04:30:00+00:00"
  }
}
```

The four count fields are nonnegative integers on successful responses. A zero
is valid. Database/request failure is an API error, not a fabricated zero result.
The timestamp is an aware ISO datetime; mobile can format it in Manila time.

### Eligibility and age

- Business ownership comes only from `BusinessProfileService.get_business_for_merchant`.
- Reuse `apps.reviews.services.review_reply_eligibility`: current published
  state, original creation no later than one captured server reference time, and
  the existing qualifying-reply predicate (reply created after/equal review
  creation and no later than that reference).
- Require no retained one-to-one reply, since `ReviewReplyService.create_reply`
  rejects a second reply regardless of timestamp validity. A malformed/future
  existing reply is therefore not actionable here. Existing Standard statistics
  intentionally remain unchanged and can count that anomaly as lacking a
  qualifying reply. Do not substitute their backlog field for this new total.
- Under-review, flagged-status, rejected, hard-deleted and future-created reviews
  are excluded. Published advisory report/device flags alone do not introduce a
  new exclusion. Current reply handling has no additional sentiment, author-status,
  community-sharing, dispute or business-status eligibility gate to reproduce.
- Age is elapsed time since original creation, not edit time or calendar days:
  under 72 hours; at least 72 and under 168 hours; at least 168 hours.
- Exactly 72 hours belongs to `days_3_to_6`; exactly 168 belongs to `days_7_plus`.
- Counts are disjoint and exhaustive within the eligible backlog, and sum to total.
- Reply creation removes a review; reply deletion restores it if still published;
  unpublishing/removal excludes it; republication uses its original creation age.

One PostgreSQL `aggregate` computes all four counts after the existing fixed-cost
ownership lookup. No review collection is materialized, and there are no MongoDB,
Celery, AI, new schema, index, migration or historical-backlog dependencies.

### Backend files

- `apps/merchant_operations/merchant_analytics/services/aged_unanswered_reviews_service.py`
- `apps/merchant_operations/merchant_analytics/serializers/aged_unanswered_reviews_serializers.py`
- `apps/merchant_operations/merchant_analytics/views/aged_unanswered_reviews_views.py`
- `apps/merchant_operations/merchant_analytics/urls.py`
- `apps/merchant_operations/merchant_analytics/services/standard_analytics_service.py`
  (extracts shared published/qualifying-reply queryset; existing outputs preserved).
- `apps/merchant_operations/merchant_analytics/services/tests/test_aged_unanswered_reviews_service.py`
- `apps/merchant_operations/merchant_analytics/views/tests/test_aged_unanswered_reviews_views.py`

## Merchant Reviews filtering

`GET /api/reviews/business/<business_id>/all/?needs_reply=true&ordering=oldest`

The additive `needs_reply` boolean is validated by `ReviewListQuerySerializer`.
When true, `ReviewService.list_reviews_queryset` requires a merchant owning the
requested business and uses the same `actionable_unanswered_reviews` helper as
the summary. Any retained reply, including a malformed timestamp, prevents a
second reply and is excluded from both actionable surfaces. Standard reply-rate
statistics retain their existing qualifying-timestamp definition.

The filter composes with sentiment, photos and topic filters before existing
pagination. Oldest ordering is stable by original creation then review ID.
`needs_reply=true&merchant_replied=true` is a controlled 400 validation error.
`needs_reply=false` and `merchant_replied=false` preserve their existing no-filter
behavior. Authentication, public review visibility and other filters are unchanged.

Relevant implementation:

- `apps/reviews/services/review_reply_eligibility.py`: shared read-only predicates.
- `apps/reviews/services/review_service.py`: ownership, filter composition, ordering.
- `apps/reviews/serializers/review_serializers.py`: additive request validation.
- `apps/reviews/views/tests/test_needs_reply_views.py`: API regression coverage.

## Mobile implementation

Paths below are relative to `sugbogo_frontend/mobile/src/features`.

| Area | Implementation |
|---|---|
| `merchant/components/analytics/AnalyticsUnansweredReviews.tsx` | Full-width `AnalyticsOverviewSection` after Specialty Support and before Visibility Trends; current total, proportional age bar, exact bucket counts and Review oldest first action. Genuine zero shows a compact all-caught-up state without an action or empty chart. |
| `merchant/api/merchantAnalytics.service.ts` and `merchant/types/merchantAnalytics.types.ts` | Typed summary request and exact backend response. No period, business ID or client cutoff is sent. |
| `merchant/hooks/analytics/useMerchantUnansweredReviews.ts` | Independent account-scoped query, 60-second freshness, focus enabled, no polling or cross-account placeholder. |
| `merchant/hooks/analytics/merchantAnalyticsQueryKeys.ts` | `[...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY, accountId, "unanswered-reviews"]`; date selector is absent. |
| `merchant/screens/merchant-mode/MerchantAnalyticsScreen.tsx` | Independent skeleton, persistent Retry, query-error notification, cached counts retained after refresh failures, pull-to-refresh inclusion. Existing Standard and Plus reports remain independent. |
| `merchant/hooks/review-management/useMerchantReviewSelection.ts` | Validates entry intent before the first feed request, consumes route parameters, preserves subsequent manual filter and sort choices. |
| `merchant/hooks/review-management/useMerchantReviewFeed.ts` | Account/filter/order-scoped `useInfiniteQuery`; server-filtered pages load on demand. The old complete-list hook remains for other consumers such as dispute creation. |
| `merchant/hooks/review-management/merchantReviewQueryKeys.ts` | Merchant feed keys remain below the existing business-review prefix and add the account and selection. |
| `merchant/components/review-management/MerchantReviewFilters.tsx` | Existing filter chips plus shared small segmented Newest / Oldest first control. |
| `merchant/screens/merchant-mode/MerchantReviewsScreen.tsx` | Server-filtered list, matching-count heading, independent backlog count, section errors and Retry, cached rows, paginated loading/footer and pull-to-refresh. |
| `explore/api/reviewBusiness.service.ts`, `explore/types/review.types.ts`, `explore/hooks/reviewQueryKeys.ts` | Additive needsReply transport and cache dimension, no change to merchantReplied false behavior. |

The section uses AppText, SafePressable, shared Skeleton and ErrorState. Neutral
and brand tones distinguish age groups without implying a response SLA. Exact
text labels supplement color. Zero buckets have no artificial segment width;
font scaling/narrow screens stack the legend. The reference cutoff is available
in the Current label's accessibility description.

### Navigation and synchronization

Analytics navigates to the existing Reviews tab with `filter=needs-reply`,
`ordering=oldest` and a new `reviewIntent` token for each action. Unsupported or
array-valued filters/orderings are discarded. Entry parameters are cleared after
consumption, so manual changes are not reset by stale intent. No new route or
navigation stack is introduced.

Reply create/update/delete mutations already invalidate both Standard Analytics
and business-review query prefixes. Summary and new merchant-feed keys deliberately
remain under these prefixes. Regression tests verify the actual keys are marked
stale; no separate invalidation infrastructure is introduced. A refocused stale
query refreshes on return, and both screens support explicit pull-to-refresh.

The summary and listing have separate server cutoffs. New reviews, moderation or
reply changes between requests can legitimately change counts. A filtered list's
pagination total means matching reviews, not the entire business review count.
There is no claim of atomic synchronization across requests.

## Verification and manual QA

Focused tests cover age boundaries, existing summary behavior, owner-only list
filtering, malformed replies, composition, oldest ordering, pagination, reply
lifecycle, account-scoped queries, intent consumption, manual selection, zero
and error states, refresh, presentation and actual reply cache invalidation.

Executed checks for this integration:

- 35 focused Django tests passed: new list-filter tests, aged-summary service/view
  tests and existing Standard service tests, using the isolated test database.
- 52 mobile tests passed across focused runs: summary API/query/component, review
  transport/keys, route selection, pagination, reply invalidation, Reviews screen
  and four affected Analytics-screen cases. The other 34 cases in that broad
  Analytics-screen suite were deliberately not run.
- Affected production/test TypeScript diagnostics passed; scoped ESLint passed.
  Six changed Python files parsed successfully and `git diff --check` passed.
- Native animation/sheet dependencies are mocked in screen tests. No physical
  device or live authenticated mobile-to-backend session was exercised.

Before release, verify on a physical Android device:

1. Open Analytics as a Standard merchant and inspect the section between Specialty
   Support and Visibility Trends; confirm proportional segments and exact counts.
2. Change 7/30/90 days: the current backlog is unchanged and not re-fetched solely
   due to the period. Pull-to-refresh includes the backlog query.
3. Open Review oldest first: Needs reply and Oldest first are selected before the
   first API request; scroll through multiple server-filtered pages.
4. Change filters/sort manually, revisit Analytics, and repeat the action. Verify
   tab/back behavior and Analytics scroll/period preservation on the device.
5. Reply to a review, return to Analytics and confirm refreshed counts; delete a
   reply and confirm eligibility is restored if still published.
6. Test zero backlog, failed initial load, failed refresh with cached values and
   next-page failure/Retry without losing loaded rows.
7. Test TalkBack, larger font settings, narrow layouts and the age legend. The
   segment colors are supplementary, not the only source of information.

No live production records, migrations, AI generation or background jobs are
required or executed by this integration.
