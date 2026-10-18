# Aged unanswered reviews: backend contract and mobile integration plan

The backend is implemented. Everything under the frontend plan below is a proposal;
no mobile code was implemented or edited by this task. No separate aged-review
wireframe image was available in the latest request, so the mapping follows the
written section specification rather than claiming image-level visual fidelity.

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
- Reuse `StandardAnalyticsService.published_reviews_at_cutoff`: current published
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

Verification: 37 affected test cases covered the new services/views and existing
Standard services/views. The initial run passed 36 and exposed one fixture author
collision from creating a review after deletion; test ordering was corrected and
that case passed on targeted rerun. Seven affected Python files parsed successfully;
`git diff --check` passed. No frontend suites or broad TypeScript checks were run.

## Verified mobile findings

Paths below are relative to `sugbogo_frontend/mobile`.

| Area | Verified implementation | Integration consequence |
|---|---|---|
| `screens/merchant-mode/MerchantAnalyticsScreen.tsx` under `src/features/merchant` | Business overview, Specialty Support, Visibility Trends, More Insights; independently loaded Plus reports; measurement sheet | Insert this Standard section immediately after Specialty Support. Current screen no longer renders Your Business Now; do not reintroduce it in this task. |
| `components/analytics/AnalyticsOverviewSection.tsx` | Wraps `MerchantContentSection` full-width surfaces, established gutters and heading | Reuse this wrapper; no outer card, Plus badge or nested banner. |
| `components/analytics/AnalyticsActivityOverview.tsx` and `AnalyticsSpecialtySupport.tsx` | Existing period KPIs/current vouch snapshot and colored specialty bars | Leave them unchanged; new backlog is a separate current snapshot. |
| `api/merchantAnalytics.service.ts`, `types/merchantAnalytics.types.ts`, `hooks/analytics/useMerchantStandardAnalytics.ts` | `apiClient -> request -> ApiResponse -> throwOnApiError -> React Query`; account-scoped period reads | Add a separate typed request and query; do not attach backlog fetching to period selection. |
| `hooks/analytics/merchantAnalyticsQueryKeys.ts` | Shared `MERCHANT_STANDARD_ANALYTICS_QUERY_KEY` prefix plus account and period | New key can be `[...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY, accountId, "unanswered-reviews"]`, with no period. |
| `screens/merchant-mode/MerchantReviewsScreen.tsx` | Local `filter = "all"`; `needs-reply` uses `!review.reply`; no sorting state or route-param handling | A generic navigation to Reviews does not activate the required filtered, oldest-first view. |
| `components/review-management/MerchantReviewFilters.tsx` | Existing All / Needs reply / Replied `FilterChip`s | Reuse chips; add an accessible oldest/newest control following existing selector conventions. |
| `src/features/explore/hooks/useBusinessReviews.ts::useMerchantBusinessReviews` | Downloads every page in a loop (100 per request), then client-filters; no server filters supplied; business-scoped merchant-all key | Extend merchant loading to backend-filtered pagination, account/filter-aware keys and FlatList end-of-list handling; avoid downloading all records to prioritize old reviews. |
| `src/features/explore/api/reviewBusiness.service.ts::getAllBusinessReviews` | Passes `ordering=oldest` when requested; only sends `merchant_replied=true` | Oldest ordering transport exists, but true unanswered filtering does not. |
| `src/features/explore/types/review.types.ts` and `hooks/reviewQueryKeys.ts` | Ordering union includes oldest, but `merchantReplied` boolean conflates false with no filter | Add an explicit unanswered filter dimension and include it in query keys. Preserve current false semantics. |
| `hooks/review-reply/useReviewReplies.ts` | Create/update/delete reply mutations invalidate Standard Analytics and business-review prefixes | The proposed summary key is already covered; keep merchant list keys below the business-review prefix too. No new invalidation infrastructure is needed. |
| `src/app/(merchant)/(tabs)/reviews.tsx` | Thin route renders MerchantReviewsScreen without params | Add validated entry-intent handling in the screen/thin route; no new route is needed. |

Other reusable state components: `src/shared/components/Skeleton.tsx`,
`ErrorState.tsx`, `SafePressable.tsx`, `AppText.tsx`, and
`src/shared/hooks/useQueryErrorNotification.ts`. `AnalyticsChartEmptyState.tsx`
supports compact empty messaging, but a short all-caught-up row is sufficient
here. The merchant Reviews screen already uses an all-caught-up mascot state.

## Proposed section and state behavior (not implemented)

New component: `src/features/merchant/components/analytics/AnalyticsUnansweredReviews.tsx`.
New hook: `src/features/merchant/hooks/analytics/useMerchantUnansweredReviews.ts`.
New type: `MerchantUnansweredReviewsSummary` in existing analytics types.
New service function: `getMerchantUnansweredReviews` in existing analytics service.
New key factory: `merchantUnansweredReviewsKey(accountId)` in existing key module.

Within `AnalyticsOverviewSection(title="Reviews needing replies")`:

1. Prominent current total, with concise context: "Published reviews waiting for your reply".
2. One segmented horizontal distribution bar sized from actual bucket counts/total.
3. Three compact labels and exact counts: Under 3 days / 3–6 days / 7+ days.
4. "View reviews needing replies" action, plus a quiet updated/as-of timestamp.

Use Nunito Sans `AppText`, shared brand/neutral tokens, existing screen gutters and
spacing, and an established link/button treatment with at least a 48dp touch area.
Do not label older reviews as overdue or automatically bad; no response SLA exists.
Do not invent a new palette; check contrast of existing tones and use text labels
so color alone carries no meaning. Do not make age groups tappable without an
actual age-filter destination. Keep the section readable when labels wrap or
font scaling makes the three groups stack.

- Initial loading: section skeleton only, reserving the total/bar/legend/action
  footprint. Other Analytics content remains available.
- Success: render backend integers directly. The only frontend calculation is
  visual segment width; never recompute eligibility, age or growth.
- Zero: show total 0, an all-caught-up message and genuine zero group counts;
  hide the chart and action instead of dividing by zero. No Retry for no activity.
- Failure: `useQueryErrorNotification` plus persistent `ErrorState(size="section")`,
  Retry calling only this query's `refetch()`. Never render missing data as zero.
- Background refresh failure: keep cached values with a visible refresh error;
  timestamp identifies their cutoff. No cross-account placeholder data.
- Focus/refresh: enable for the focused authenticated merchant, use the existing
  short cache policy (60 seconds), and include its refetch in page pull-to-refresh.
  Avoid polling. Period changes must neither rekey nor reset this snapshot.
- Reply mutation: existing Standard-prefix invalidation marks this query stale;
  focus-enabled re-entry fetches the current backlog after replying/deleting.
- Accessibility: expose exact age-group labels/counts as readable text; treat
  segments as decorative or provide one equivalent concise chart description.
  Keep the navigation action separately focusable. Test TalkBack and font scaling.

## Required navigation/backend follow-up (not implemented)

Intended navigation proposal:

`/(merchant)/(tabs)/reviews` with `filter=needs-reply` and `ordering=oldest`.

Validate and consume the entry intent once, applying it before the first feed
request. Avoid reapplying stale route params after manual filter changes; a later
Analytics action must be able to request the intent again. Use existing tab
navigation so Analytics remains mounted with its selected period/scroll state.
Review the app's actual tab-back behavior on Android; the tab layout currently
does not explicitly configure backBehavior, so do not promise Back always returns
to Analytics without a device/navigation check.

Existing backend `ReviewService.list_reviews_queryset` supports stable oldest
ordering (`REVW_CREATED_AT`, then `REVW_ID`) and applies filters before pagination.
But `merchant_replied=false` currently means all reviews, not unanswered ones.

Before enabling the action, extend the existing list query serializer/service
with an additive `needs_reply=true` filter (proposal, not an existing API field).
Use this summary's published/current-cutoff/no-retained-reply eligibility, and
reject conflicting `merchant_replied=true` plus `needs_reply=true` inputs. Do not
reinterpret old false values. Reuse/extract the shared eligibility predicate as
needed without changing moderation or existing reply calculations.

Relevant backend files for that separate follow-up:

- `apps/reviews/serializers/review_serializers.py::ReviewListQuerySerializer`
- `apps/reviews/services/review_service.py::list_reviews_queryset`
- `apps/reviews/views/review_views.py::ReviewListView`
- Existing review service/view test modules.

Extend the mobile review filter type, query key, API parameter builder and
merchant list hook together. Preserve unfiltered total-review heading semantics:
the filtered list's `pagination.total_items` is the count matching that filter,
not the whole published-review count. Keep total/needs-reply summaries independent
of the currently loaded page. A separate unfiltered count source or explicitly
scoped heading is needed when moving off the complete-collection hook.

There is no immutable snapshot token for the list. Replies, moderation and new
reviews between the summary and list requests can legitimately change counts;
refresh both rather than claiming they must always match.

## Ordered frontend implementation checklist

1. Complete the additive backend list filter and tests for eligibility, oldest
   tie-breaks, pagination, conflicting inputs and ownership-context navigation.
2. Add the summary type/service/key/hook and tests for account switching, no
   period dependency, valid zero, failure/Retry, refresh and cached content.
3. Update merchant list transport, account/filter-aware pagination keys and
   loading/footer behavior; retain the business-review invalidation prefix.
4. Handle the validated route entry intent; add the sorting control and verify
   repeated navigation, manual filter changes and returning to Analytics.
5. Add AnalyticsUnansweredReviews and its independent skeleton/empty/error states,
   then insert it between Specialty Support and Visibility Trends. Keep all Plus
   access handling and existing analytics sections unchanged.
6. Verify reply create/delete invalidation, shared totals semantics, aged group
   boundaries, network failures, zero totals and standard merchant access.
7. Compare against the actual aged-review wireframe when supplied; perform Android
   visual/accessibility QA, narrow screens, long counts, font scaling, TalkBack,
   back/tab navigation and scroll/period preservation.

This checklist is for review only; none of its frontend tasks were performed.
