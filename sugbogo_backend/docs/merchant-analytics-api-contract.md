# Merchant Standard analytics and Merchant Plus gate

This branch creates and registers `apps.merchant_operations.merchant_analytics`, following the existing `business_profile` services/serializers/views layout. It has no models, migrations or dependencies. All analytics methods are read-only; no index creation, event writes, Discovery Score changes, Gemini calls or payments are introduced.

## Standard endpoint

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

| Location | Responsibility |
|---|---|
| `config/settings.py`: `MERCHANT_PLUS_ENFORCED` | Server-side enforcement toggle, default False. Environment accepts True/False (case-insensitive); invalid values fail startup rather than silently bypass enforcement. |
| `merchant_analytics/entitlements.py`: `merchant_has_plus_access(user)` | Single future entitlement integration point. Returns True while enforcement is off; currently False when enabled. Replace the final return with the approved plan check later. |
| `merchant_analytics/permissions.py`: `HasMerchantPlus` | Permission for every future Premium view; denial raises `MerchantPlusRequired`, yielding HTTP 403 and `code: PLUS_REQUIRED` through the existing global handler. |
| `serializers/standard_analytics_serializers.py` | Standard allowlist; do not add Premium values and merely hide them in the UI. |

Future Premium views must declare `IsAuthenticated`, `HasRole(User.UserRole.MERCHANT)`, and `HasMerchantPlus`, then derive ownership server-side before reading metrics. The Plus permission is not an ownership or role check. Standard deliberately does not declare it and stays accessible when enforcement is on. Add Premium routes and serializers separately.

**This branch implements no Premium analytics endpoint.** The gate scaffold is ready for later full review insights, visibility/review trends, comparisons, local peer benchmarks and reports. Existing public review summaries remain public. The flag does not itself create those features, nor is it a subscription system. Leaving enforcement off permits future authenticated/owned Premium previews; switching it on currently denies all Premium requests until a real entitlement lookup is added. No UI state, query parameter or guessed user attribute grants an entitlement.

Keep enforcement disabled for the agreed development preview. Before enabling it for paying users, coordinate the real plan/entitlement structure with Ralph and test both eligible/denied accounts. No plan model/payment processing is introduced here.

## Verification for members

1. Run the new app's service/view tests and existing Pocket, vouch, visibility and shared analytics regressions against a disposable PostgreSQL/PostGIS test database. Mongo pipeline tests are mocked read-only; production Mongo compatibility/coverage still needs infrastructure verification.
2. Authenticate merchant A/B with distinct businesses and data; each Standard response must contain only that merchant's aggregates. Business-ID/client-Plus parameters must be rejected; nonmerchant/inactive/anonymous access must fail.
3. Compare stored profile/SAVE observations using the exact UTC bounds. Repeat a visitor over multiple dates; confirm one period-wide visitor. Unsave and confirm holder count falls while prior SAVE events remain.
4. Confirm zero-support active specialties, inactive links, invalid evidence and valid suspicious evidence follow existing rules. Never compare against unfiltered cached totals.
5. Validate published/rejected/under-review reviews, old unanswered backlog, replies after the selected end but before generated cutoff, future/negative replies, and null denominator vs 0% response.
6. With enforcement off, the Standard response must still contain no Premium/comparison fields. With enforcement on, Standard remains available. Test the gate through test-only views; denied Premium probe receives `PLUS_REQUIRED`. No production Premium probe route is exposed.
7. Check that Mongo failure produces null visibility/partial metadata while SQL metrics remain readable. Preserve legitimate healthy zeros.
8. Frontend should display event counts, current snapshots, cohort percentages and cutoff labels distinctly; no trend arrows or Premium numbers should be synthesized from this response.

No frontend is modified. Test execution/results are reported after the separately approved run.
