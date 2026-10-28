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

## UI foundation

The components in `components/` do not fetch data or own notifications:

| Component | Responsibility and reuse |
| --- | --- |
| `AnalyticsSection` | Named report region with heading, description, wrapping controls/action, footer and explicit request/data states. Reuses `DataErrorState` and `Button`. |
| `AnalyticsMetricCard` | Adapts backend values/comparisons to the existing Admin `MetricCard`. Does not derive percentages or interpret comparison direction as quality. |
| `AnalyticsMetricGrid` | One/two/four-column grid; reuses `MetricCardsSkeleton` for initial loading. |
| `AnalyticsChartCard` | Section plus a stable chart slot, readable figure caption and an exact-value alternative slot. Does not configure charts. |
| `AnalyticsTableSection` | Section plus existing `DataTable`, including its filter slots, empty configuration and server pagination. Does not slice or own table state. |
| `AnalyticsDataNotice` | Compact info, partial, unavailable, snapshot or fixed-window context. Caller supplies readable explanations rather than raw machine reason codes. |
| `AnalyticsReportSkeleton` | Chart/table space reservation without fake values; animation respects reduced motion. |
| `AnalyticsPeriodControl` | Controlled applied selection with local custom-date drafts. Complete ordered ranges must be explicitly applied. |
| `AnalyticsMetricSelector` | Thin adapter around labelled native `SelectInput`; choices come from each report's supported metrics. |
| `AnalyticsIntervalControl` | Reuses the selector for daily/weekly; independent of period and fetching. |

### State integration

Pass `isLoading`, `isFetching`, `error` and the section's `refetch` from its query.
Set `hasData={query.data !== undefined}` so background failures retain the last
loaded report. Initial errors use the shared persistent error state; refresh
errors display a compact explanation and Retry alongside retained content.
Pages continue to own `useApiErrorNotification()`.

`isEmpty` and `unavailable` are explicit report-level decisions. The containers
never infer emptiness from zero, missing buckets, null percentages, or a single
source's metadata. A partial source is not a transport failure. Supply readable
`partialNotice` or `unavailableMessage` close to the affected report. Whole-report
unavailability suppresses a redundant partial notice.

Table consumers pass the existing DataTable contract through `tableProps`:
`data`, `columns`, controlled `state`/`pagination`, server totals and handlers,
`config` and `slots`. A null `data` selection is unavailable, not an empty array.
Explicitly use query-data presence for `hasData` during initial loads if a table
adapter initializes rows to an empty array. Empty text uses DataTable's existing
`config.emptyState`/`noResultsState`. Keep category filters in `FilterMenu`; the
new section can accept that existing control without duplicating it.

### Metric semantics and accessibility

Zero is formatted as a measured value. Null/undefined displays `Unavailable` and
never reaches the formatter. Supply the backend label and measurement scope;
`current_snapshot`, `period` and `period_current_state` have readable defaults,
with an explicit label override for legacy/fixed windows. Do not relabel recorded
discovery accounts as MAU or current-role cohorts as immutable acquisition.

Comparisons use the supplied value/unit/direction unchanged. Intent defaults to
neutral; explicitly choose positive or negative based on the metric's product
meaning. An undefined comparison displays `Comparison unavailable` when supplied;
no client-side percentage is calculated. Direction has screen-reader text and an
icon, so color is not the sole cue. Existing MetricCard consumers keep their trend
variants and default footer behavior.

Sections have associated headings/descriptions. Native controls have labels,
selected/expanded state and visible focus. Date drafts use calendar strings;
missing/reversed dates cannot apply. The backend still validates calendar and
future bounds. Presets discard custom dates through the Phase 3 serializer.

Chart consumers should supply a concise summary and exact values through text or
an accessible table in `accessibleData`. Do not make every SVG point focusable.
The chart slot is 256px high, increasing to 288px at the existing small breakpoint.
Headers wrap, grids collapse to two/one columns, and DataTable retains horizontal
scrolling. Existing light/dark tokens and Lucide icons are reused.

The Analytics page currently mounts only overview, with a shared header and
reporting control. It deliberately renders no fake KPIs, temporary charts or full
dashboard arrangement. Visual review fixtures are temporary and are not shipped.
