# Admin Analytics frontend data foundation

The dashboard UI is deliberately not implemented here. Each exported hook in
`hooks/useAnalyticsReports.js` owns one independent React Query request. Services
live in the existing `../services/analyticsService.js`; the old raw-response
`getAnalyticsData()` export remains compatible.

## Reports and parameters

All query keys start with `["admin", "analytics", report, normalizedParams]`.
Use `analyticsQueryKeys` or `analyticsQueryOptions`, rather than hand-written keys.
The same normalized parameters determine both the cache key and HTTP request.

| Report key | Hook | Service function | Supported parameters |
| --- | --- | --- | --- |
| `platformOverview` | `usePlatformAnalytics` | `fetchPlatformAnalytics` | dates |
| `platformGrowth` | `usePlatformGrowthAnalytics` | `fetchPlatformGrowthAnalytics` | dates, interval |
| `discoveryTrend` | `useDiscoveryTrend` | `fetchDiscoveryTrend` | dates, interval, metric |
| `onboarding` | `useOnboardingAnalytics` | `fetchOnboardingAnalytics` | dates |
| `attentionQueue` | `useAttentionQueueAnalytics` | `fetchAttentionQueueAnalytics` | dates |
| `coverage` | `useCoverageAnalytics` | `fetchCoverageAnalytics` | dates, cluster, category |
| `businessAttention` | `useBusinessAttention` | `fetchBusinessAttention` | dates, cluster, category, ordering, page, page_size |
| `lowExposure` | `useLowExposureBusinesses` | `fetchLowExposureBusinesses` | cluster, category, ordering, page, page_size; **no dates** |
| `communityHealth` | `useCommunityHealthAnalytics` | `fetchCommunityHealthAnalytics` | dates, interval |
| `specialtySupport` | `useSpecialtySupportAnalytics` | `fetchSpecialtySupportAnalytics` | dates as metadata context only; current snapshot |
| `changeRequests` | `useChangeRequestAnalytics` | `fetchChangeRequestAnalytics` | dates |
| `discoveryHeatmap` | `useDiscoveryHeatmap` | `fetchDiscoveryHeatmap` | dates, cluster, category, metric=profile_visits, cell |
| `discoveryScores` | `useDiscoveryScoreAnalytics` | `fetchDiscoveryScoreAnalytics` | search, status, cluster, category, specialty_tag, score_state, ordering, page, page_size; no dates |

Routes follow the backend API contract. Platform overview uses `/admin/analytics/`;
other routes use their hyphenated backend names. The shared API client supplies
the configured `/api` base, authentication, refresh and error handling.

`dates` means `period: "7" | "30" | "90" | "custom"`, default `"30"`.
Custom selection requires `start_date` and `end_date` as inclusive `YYYY-MM-DD`
calendar strings. `serializeReportingPeriod()` sends dates only for custom
selections; it never calculates timezones, previous periods or UTC boundaries.
The API validates date chronology, calendar validity and future bounds.
Interval is separately `daily | weekly`, default `daily`, only where supported.
Draft/incomplete custom selections should be kept in form state until valid
parameters are ready to pass to a hook, including a disabled hook.

Unknown filters are omitted per report. Invalid supported enums, malformed custom
date selections and invalid positive IDs/pagination raise `RangeError` before a
request. Do not catch these programming/form-input errors and display zero counts.
Use backend names `cluster`, `category`, `specialty_tag` where supported, not aliases.

## Query behavior and section ownership

Each hook accepts `(params, { enabled = true } = {})` and returns the native
React Query result:

- `data` is the unwrapped backend report, undefined before a successful load.
- `isPending` identifies absence of loaded query data; `isLoading` identifies an
  initial fetch. A disabled query can be pending without fetching.
- `isFetching` also indicates background refresh; loaded data is retained.
- `error`/`isError` identify request failure, including failed refresh with retained data.
- `refetch()` retries that section only, without invalidating sibling reports.

Pages own `useApiErrorNotification(error, { toastId, fallbackMessage })`. Each
mounted section must also display its persistent error state and wire Retry to
its own `refetch()`. Keep successful sibling sections mounted. A failed background
refresh may show retained values alongside a refresh error; never clear them to zero.

Queries use a one-minute stale time to reduce repeated reads on navigation. They
inherit the global QueryClient's retry=1 and refetchOnWindowFocus=false settings.
No polling, custom reconnect policy, prefetch-all or cross-report invalidation is
introduced. Heatmap/score queries run only when their hooks are mounted and enabled;
the minimal Analytics page mounts only overview. Existing Discovery Scores list,
opt-in visibility diagnostic and mutation consumers remain unchanged.

## Data semantics and pagination

Transport normalization unwraps `response.data.data` only. It does not fill,
round, relabel, sum, zero-fill or calculate percentages. Preserve every backend
definition, denominator, comparison, sample/exclusion count and time scope:

- `0` is observed zero; `null` is unavailable/undefined. Missing series positions
  and sparse-series flags remain unchanged.
- Current snapshots and legacy native windows remain distinct from selected-period
  measurements. Specialty support is current even when its metadata has a period.
- Current-role Explorer populations are not immutable Explorer acquisition;
  discovery-active accounts are recorded activity, not general platform MAU.
- SLA uses classified outcomes only; resubmission means post-rejection submission.
- HTTP success with partial/unavailable metadata remains successful query data.
  Inspect `meta`, `sources`, `selection_status`, freshness and coverage warnings in
  the later UI. Do not throw merely because a source is unavailable.
- `items: null, pagination: null` means unavailable selection, not an empty table.
  `items: []` with pagination is an empty server result. Preserve pagination exactly.

Table hooks do not use previous-selection placeholders or local slicing. A new
page/order/filter gets its own server dataset and loading state (or matching cached
dataset). Changing filters in the future table UI should reset page to 1 explicitly.
No stale rows are presented as belonging to a new selection.

## Focused tests

From `web_app` with Node available:

```sh
node --test --test-concurrency=1 src/features/admin-panel/analytics/queries/analyticsData.test.js src/features/admin-panel/analytics/hooks/useAnalyticsReports.test.js
```

Tests use the existing Vite SSR, Node test and sibling mobile JSDOM setup; no new
test packages are required. Transport is stubbed, while real hooks and QueryClient
exercise response semantics, independence, Retry, period/filter changes and background
refresh. The minimal page is exercised without implementing dashboard visuals.
