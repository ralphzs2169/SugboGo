# Merchant analytics and Merchant Plus gate

The registered `apps.merchant_operations.merchant_analytics` follows the existing `business_profile` services/serializers/views layout. It has no models, migrations or dependencies. All analytics methods are read-only; no index creation, event writes, Discovery Score changes, Gemini calls or payments are introduced.

## Standard endpoint

Standard remains separate from the Premium routes documented below.

`GET /api/merchant/analytics/standard/` requires an authenticated active merchant. Admin/superadmin/explorer roles are not merchant roles. The existing owner lookup derives the business from `request.user`; no business/user/entitlement identifier is accepted from request parameters. A merchant without a business receives the existing 404 `NOT_FOUND`. An owned business with no records receives zero healthy counts and a null reply rate.

Accepted query keys: `period=7|30|90|custom` (default 30), `start_date`, `end_date`. Custom dates are inclusive Manila dates resolved to UTC [start,end) bounds. Unsupported parameters are rejected with the existing validation envelope. Client clocks, thresholds, metrics, business IDs and Plus claims cannot alter the selection.

Successful responses use `core.responses.success_response`:

```text
data:
  business: {id, name, status}
  profile_visits: integer or null
  distinct_profile_visitors: integer or null
  saves_in_period: integer or null
  current_pocket_holders: integer
  specialty_support:
    [{specialty_id, specialty_name, valid_vouches, distinct_supporters}]
  reviews:
    new_published_in_period
    current_published_total
    current_unanswered_published
    period_eligible_published
    period_replied_published
    reply_rate: percentage or null
    reply_cutoff
    excluded_reply_timestamp_count
  snapshot_as_of
  meta: period, data_through, generated_at, availability,
        is_partial, partial_reason, partial_reasons, coverage_verified
  sources: {domain: meta, visibility: meta}
```

Every period object includes only `timezone`, `start_date`, `end_date`, `start`, `end_exclusive`. Shared internal date helpers still calculate prior bounds, but Standard neither queries them nor returns them. Serializers deliberately allowlist output. There are no comparisons, changes, prior values/boundaries, time series, impressions, distinct savers, sentiment insights, reply-time medians, peer benchmarks or reports. Internal shared visibility reads may include other event types, but those values never enter the Standard payload.

### Metric definitions

- Profile visits count retained `PROFILE_VISIT` events; distinct visitors are distinct explorers across the whole selected period for this business and that event type. Existing UTC-day deduplication stays unchanged; this is not every profile opening.
- Saves are retained `SAVE` events in the selected period. Current Pocket holders count distinct users with current SQL Pocket rows created by the snapshot cutoff. Unsave removes a holder, not a retained historical SAVE event. No cached Pocket counter or inferred historical unsave/net-growth is used.
- Specialty rows cover current active business-specialty links, including zero-support links. Count valid retained vouches and distinct users per specialty. Invalid evidence and inactive links are excluded. Suspicion alone is not invalid evidence. One person can support multiple specialties, so per-specialty counts must not be summed into a business-wide distinct-person total. No cached vouch/score counter is used.
- New reviews are currently published reviews created in the selected period. Current published total and unanswered backlog cover all dates up to the snapshot cutoff. Owned suspended businesses remain readable by active owners, matching the existing ownership retrieval; suspension is not silently converted into an empty report.
- Reply-rate denominator is currently published reviews created in the selected period. Numerator is those with a retained reply created no earlier than the review and no later than `generated_at`. Reply cutoff is `generated_at`, not selected-period end: an older review answered after that period can count as answered in today's cohort report. Empty denominator gives null; zero valid replies among eligible reviews gives 0%.
- `current_unanswered_published` is the entire current published backlog without a reply eligible at that same cutoff. It does not shrink merely because a shorter reporting period is selected.
- Future review/Pocket/vouch creation timestamps do not enter the current snapshot. Future or negative reply timestamps are excluded; `excluded_reply_timestamp_count` covers retained replies on all current eligible published reviews, not only the selected cohort, and metadata discloses anomalies.
- Publication status, evidence validity, active specialty classification and retained replies are evaluated at query time. Creation cutoff is not reconstruction of historical statuses. Deletion/moderation/unvouch/reply removal can revise earlier-period results; label current-state reporting.

Mongo failures preserve available SQL data and return null affected visibility metrics, never artificial zeros. Independent event-total/distinct reads preserve partial success. Visibility coverage/freshness remain unverified even when reads succeed. Source metadata distinguishes unavailable visibility from successful current SQL counts. Domain `data_through` denotes the selected cohort query end; `snapshot_as_of` and `reply_cutoff` separately label current snapshots. Overall Standard metadata is partial due to current-state and unverified tracking limitations.

## Ralph: where Premium enforcement lives

All five Premium view classes inherit the same authentication, merchant-role and `HasMerchantPlus` permissions. With `MERCHANT_PLUS_ENFORCED=False`, active merchants can preview them. With enforcement enabled, the current entitlement stub denies access before ownership/service queries. A future approved server entitlement lookup can grant access without changing endpoint permissions. No client entitlement claim is accepted.

| Location | Responsibility |
|---|---|
| `config/settings.py`: `MERCHANT_PLUS_ENFORCED` | Server enforcement toggle, default False; accepts True/False and rejects invalid values. |
| `merchant_analytics/entitlements.py`: `merchant_has_plus_access(user)` | Returns True while enforcement is off; currently False when enabled. Replace the final return with the approved plan check later. |
| `merchant_analytics/permissions.py`: `HasMerchantPlus` | Every Premium view uses this; denial returns HTTP 403 with code PLUS_REQUIRED. |
| `serializers/standard_analytics_serializers.py` | Standard allowlist; never add Premium values and merely hide them in the UI. |

The Plus permission does not replace role or ownership checks. Existing public review summaries remain public. Local peer benchmarks, report exports and the real entitlement lookup remain future tasks. Keep enforcement disabled for the agreed development preview. Before enabling it for paying users, coordinate the entitlement structure with Ralph and test eligible/denied accounts. No plan model/payment processing is introduced here.

## Premium endpoint contract

Every route below uses `GET`, the existing success/error envelope, and authenticated ownership. Prefix: `/api/merchant/analytics/`. Date query parameters match Standard. Only visibility additionally accepts `interval=daily|weekly` (default daily); the other trend endpoints use fixed weekly buckets. Unknown business/user/entitlement parameters are rejected. No business receives 404; an owned empty business returns healthy zero counts with null undefined rates/medians.

| Route | Response fields beyond `business` and `meta` | Suggested presentation |
|---|---|---|
| `premium/visibility/` | `interval`, `metrics` keyed by impressions, profile_visits, distinct_profile_visitors; measurement_note | Metric-selectable daily/weekly line chart and current/prior totals |
| `premium/pocket/` | `interval=weekly`, `metrics` keyed by saves and distinct_savers; measurement_note | Weekly bars and period totals; separate from Standard current holders |
| `premium/specialties/` | `label`, `interval=weekly`, `snapshot_as_of`, `specialties` | Per-specialty weekly bars labeled **Added and still valid** |
| `premium/review-insights/` | `stored_summary` or null, measurement_note | Stored narrative, sentiment breakdown, mention list, sample/state/freshness labels |
| `premium/review-performance/` | current/previous cohorts, weekly series, reply_rate_change, current_unanswered_published, reply_cutoff, excluded_reply_timestamp_count, measurement_note | Review-volume/sentiment bars, reply-rate line, retained reply median and backlog cards |

### Visibility and Pocket payload

Each metric has `value`, `previous_value`, `change` (value, direction, unit, reason), `series`, `series_is_sparse=true`, and independent `sources.current`/`sources.previous` metadata. Series points expose only date, start, end_exclusive, value. Bucket labels use Manila days or Monday weeks, with effective bounds clipped to the selected period. Period-wide distinct profile visitors filter PROFILE_VISIT; distinct savers filter SAVE. Never sum bucket uniques into a period unique count.

Successful empty reads return value 0 and series []; failed reads return null, not zero. Successful portions survive separate read failures. Series are sparse: omitted buckets must not be filled with zero while coverage is unverified. Existing UTC-day tracking deduplication is preserved. Prior periods are exactly equal elapsed lengths immediately before the current period.

**Approved limitation:** there is no verified tracking coverage/watermark. Like admin discovery analytics, current/prior recorded totals are returned but percentage change is null with `coverage_unverified` when both reads succeed, or `data_unavailable` when a total fails. A live Mongo ping or first event date cannot establish complete coverage. Real Mongo deployment/coverage verification remains a later task. No endpoint/query flag can bypass this rule.

### Specialty payload and true history

Each current active specialty has specialty_id/name, period `added_and_still_valid`, period `distinct_supporters`, and weekly rows with the same two counts. Include zero-count current specialties. Only retained valid vouches created in [start,end) qualify; current active links must exist by generated_at. Suspicion alone does not invalidate evidence. Supporters are distinct within each specialty/period, never a summed business-wide unique total. Current valid status and active classification do not reconstruct past states.

Unvouch deletes rows. Invalidations and deactivations can also change previous-period results. Metadata includes `retained_valid_vouches_only` and `vouch_removal_history_unavailable`. These are surviving creation cohorts, not net additions or historic support balances.

True history requires immutable create/remove/invalidate/revalidate events, relevant specialty activation history, event timestamps and deduplication identifiers, plus an agreed baseline and retention policy. Missing deleted records cannot be backfilled accurately. Such persistence changes require a separate design approval and migration decision; none are included here.

### Stored review insights

`stored_summary` reuses the safe public serializer from `docs/review-insights-api-contract.md`: state/message, content_available, narrative, review_count, eligible/analyzed/classified counts, minimum_eligible_review_count, has_sufficient_sentiment_data, overall_vibe, is_sampled, sentiment, frequent_mentions, coverage_start/end, generated_at, sentiment_computed_at, updated_at. Private evidence IDs, retry/provider state, fingerprints and installation identifiers are never exposed. Mentions contain label/count only; no polarity is inferred.

The stored summary retains its own rolling 30-day coverage independently of selected dates. It is not regenerated for a 7/90/custom range. Missing stored summary is null with `stored_summary_missing`; no new summary is created. Pending/insufficient/invalidated content follows the existing content gate; retained outdated content is labeled outdated. Mention counts refer only to analyzed reviews, with `is_sampled` showing whether they are a subset of eligible reviews. Generation requires five eligible nonblank reviews; the sufficient-sentiment flag/overall vibe require five classified reviews. Existing stored percentage behavior is preserved, including 0.0 for an empty stored denominator; clients must use classified_review_count and the sufficient-data flag. Analytics trend percentages instead use null when no reviews are classified.

**Legacy policy discrepancy:** the generation policy excludes spam/device-abuse-flagged reviews for generated content, but the maintained sentiment recomputation query filters current published status and dates only. This endpoint reads stored output without changing that pipeline. Selected-period trends likewise use stored labels on current published reviews and disclose that scope.

### Review performance

Current/previous cohorts use current published reviews created in each period. Each cohort returns published_review_count, replied_review_count, unanswered_cohort_count, reply_rate, classified_review_count, unclassified_review_count, has_sufficient_sentiment_data, sentiment counts/percentages, median_first_reply_seconds, median_replied_sample_size. Weekly series uses the same count/rate/sentiment measures, zero-filled for healthy SQL empty weeks. Positive/neutral/negative shares use pooled classified counts, never averages of weekly shares. Unclassified reviews are excluded from sentiment denominators. Below five classified reviews, counts/shares remain available but the sufficient-data flag is false; no overall sentiment conclusion is inferred.

Reply numerator uses a retained reply created between the review creation and the single report generated_at cutoff; denominator is the published review-creation cohort. Older selected cohorts can include replies after period end. Recent cohorts have less opportunity to receive replies. Median duration uses only valid replied reviews in the cohort; unanswered reviews are excluded. No replied reviews produces null median/sample 0. Future/negative replies are excluded and counted across the entire published backlog. Deleted/recreated replies can lose the true original first-reply timestamp; this is a median of retained reply records.

`reply_rate_change` is percentage points, with null comparison when either cohort denominator is zero; the shared helper requires at least one eligible review per cohort. `current_unanswered_published` covers all current published reviews, independent of selected dates. Current-state moderation/deletion and reply-history limitations appear in metadata. This task includes no district/cluster peer comparisons or report exports.

### Premium verification

1. With enforcement off, authenticate as merchant A and GET all five routes. Repeat as merchant B with distinct fixtures; each response must contain only its owned business aggregates.
2. Try business_id/user_id/plus query overrides; expect 400. Anonymous, explorer/admin/superadmin, and inactive merchant requests must be rejected.
3. Enable enforcement and restart the server: every Premium route must return 403 PLUS_REQUIRED with the existing stub; Standard remains accessible. Test future entitlement approval through the server-side test mock only.
4. Check 7/30/90/custom Manila boundaries and daily/weekly visibility. Add one visitor across multiple days: period uniques must remain one; SAVE-only users must not count as profile visitors.
5. Check healthy empty data versus simulated Mongo failure: zero/[] versus null/unavailable. No numerical visibility growth is expected while coverage is unverified.
6. Check vouch deletion/invalid evidence/inactive specialty behavior and labels. Check missing, pending, insufficient, ready, outdated, invalidated and sampled stored insights; GET requests must neither write summaries nor trigger Gemini.
7. Check pooled sentiment, empty denominators, reply cutoff, retained-reply median, weekly cohort totals and whole-backlog unanswered count.

Focused regression command (from sugbogo_backend, approved disposable PostgreSQL/PostGIS test database required):

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.business.services.tests.test_visibility_analytics_service apps.shared.analytics apps.admin_operations.analytics --noinput
```

These automated tests use a mocked read-only Mongo collection. Live Mongo aggregation compatibility, indexes, production tracking completeness, query performance and frontend integration require later verification. Do not present a simulated outage test as a live deployment test.

## Verification for members

1. Run the new app's service/view tests and existing Pocket, vouch, visibility and shared analytics regressions against a disposable PostgreSQL/PostGIS test database. Mongo pipeline tests are mocked read-only; production Mongo compatibility/coverage still needs infrastructure verification.
2. Authenticate merchant A/B with distinct businesses and data; each Standard response must contain only that merchant's aggregates. Business-ID/client-Plus parameters must be rejected; nonmerchant/inactive/anonymous access must fail.
3. Compare stored profile/SAVE observations using the exact UTC bounds. Repeat a visitor over multiple dates; confirm one period-wide visitor. Unsave and confirm holder count falls while prior SAVE events remain.
4. Confirm zero-support active specialties, inactive links, invalid evidence and valid suspicious evidence follow existing rules. Never compare against unfiltered cached totals.
5. Validate published/rejected/under-review reviews, old unanswered backlog, replies after the selected end but before generated cutoff, future/negative replies, and null denominator vs 0% response.
6. With enforcement off, the Standard response must still contain no Premium/comparison fields. With enforcement on, Standard remains available and all five Premium routes deny with `PLUS_REQUIRED` until the real entitlement check is implemented.
7. Check that Mongo failure produces null visibility/partial metadata while SQL metrics remain readable. Preserve legitimate healthy zeros.
8. Frontend should display event counts, current snapshots, cohort percentages and cutoff labels distinctly; no trend arrows or Premium numbers should be synthesized from this response.

No frontend is modified. Test execution/results are reported after the separately approved run.
