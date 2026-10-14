# Merchant analytics and Merchant Plus gate

The registered `apps.merchant_operations.merchant_analytics` follows the existing `business_profile` services/serializers/views layout. Analytics GET methods remain read-only. The separately approved mock Plus task adds a demo entitlement model/migration and mutation APIs; see [the simulation API contract](merchant-plus-mock-api-contract.md). No index creation, event writes, Discovery Score changes, Gemini calls or payments are introduced by analytics requests.

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

All seven Premium view classes, including peers and the composed report, inherit the same authentication, merchant-role and `HasMerchantPlus` permissions. With `MERCHANT_PLUS_ENFORCED=False`, active merchants can preview them. With enforcement enabled, access is granted only to active owned-business demo entitlements while explicit mock mode is enabled; otherwise it fails closed. A future real entitlement integration remains separate. No client ownership/entitlement claim is accepted.

| Location | Responsibility |
|---|---|
| `config/settings.py`: `MERCHANT_PLUS_ENFORCED` | Server enforcement toggle, default False; accepts True/False and rejects invalid values. |
| `config/settings.py`: `MERCHANT_PLUS_MOCK_ENABLED` | Default False; enables demo mutations and recognition of demo grants under enforcement. Keep off outside explicit demonstrations. |
| `merchant_analytics/entitlements.py`: `merchant_has_plus_access(user)` | Preview bypass when enforcement off; owned demo lookup only under mock enforcement; real paid lookup remains future work. |
| `merchant_analytics/permissions.py`: `HasMerchantPlus` | Every Premium view uses this; denial returns HTTP 403 with code PLUS_REQUIRED. |
| `serializers/standard_analytics_serializers.py` | Standard allowlist; never add Premium values and merely hide them in the UI. |

The Plus permission does not replace role or ownership checks. Existing public review summaries remain public. Anonymous category/cluster peers and the JSON report are implemented below; PDF exports and real paid entitlement lookup remain future tasks. Use enforcement True and mock True for the deny/activate/reset demonstration; preview mode remains available when enforcement is False. Persistent demo access is not payment verification or a pricing-plan model. See the simulation contract for migration approval and the configuration matrix.

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

`reply_rate_change` is percentage points, with null comparison when either cohort denominator is zero; the shared helper requires at least one eligible review per cohort. `current_unanswered_published` covers all current published reviews, independent of selected dates. Current-state moderation/deletion and reply-history limitations appear in metadata. Peer comparison and the composed JSON report are documented in the next section; PDF export is not implemented.

## Peer comparison and composed report

| Endpoint | Accepted parameters | Access |
|---|---|---|
| `GET /api/merchant/analytics/premium/peers/` | period, start_date, end_date | Active authenticated merchant + HasMerchantPlus + owned business |
| `GET /api/merchant/analytics/premium/report/` | period, start_date, end_date, interval=daily/weekly (default daily for visibility) | Same Premium permission chain |

Business IDs, category/cluster selectors, thresholds, user IDs and entitlement claims cannot be supplied by the client. Missing owned business returns 404. The report is explicitly Premium even though it includes a sanitized Standard subsection; the standalone Standard endpoint remains unchanged and ungated by Plus.

### Peer group and disclosure policy

Merchant-owned constants are in `merchant_analytics/constants.py`: `MIN_PEER_GROUP_SIZE=5` and display precision two decimal places. Five is an initial product disclosure threshold, not a statistical-confidence or anonymity guarantee. The existing classified-review threshold is reused from `apps/reviews/constants.py` rather than duplicated.

Eligible peers are current active businesses in the merchant's category's cluster, created by generated_at. Exclude the owned business **before counting**. Prefer the same category if it contains at least five other eligible businesses; otherwise use all eligible businesses in the cluster, with `fallback_reason=category_group_too_small`. Category/cluster are taxonomy relationships, not geographic districts. Suspended businesses and future-created rows are excluded; verified status and owner-account status do not add eligibility filters. Current status/classification is not historical inventory, and newer businesses have shorter exposure; lifetimes are not normalized. The selected group is fixed for all metrics, even if sentiment samples are insufficient.

If the resulting group is below five, top-level status is insufficient_data with reason peer_group_too_small. Group size/scope/minimum/fallback metadata remains visible. All metric values, medians, positions and eligible sample sizes are null; no metric reads are performed for that group. Owned Standard/Premium report sections remain usable. No peer names, IDs, individual metric rows, locations or review evidence are returned, even for sufficiently large groups.

Each metric has label, unit, status, reason, merchant_value, peer_median, position, eligible_peer_sample_size, and merchant_classified_review_count (only populated for an available sentiment comparison). Group size describes inventory; eligible metric sample size can be smaller. Positions are above_median/at_median/below_median based on the same rounded values displayed to clients. Even groups use the mean of the two middle values. No rankings, percentiles or business-quality conclusions are inferred.

### Peer metric definitions

- Profile visits and saves count existing deduplicated PROFILE_VISIT/SAVE events in the same [start,end) window for each business. Healthy zero-event businesses remain in medians. SAVE events are not current Pocket holdings. Reads are batched for the group and owned business. Mongo failure suppresses both merchant and median values for these comparisons, with status unavailable/reason visibility_unavailable; SQL comparisons survive. Successful recorded comparisons have status partial/reason coverage_unverified. They are observations, not verified complete performance benchmarks; no recommendation is inferred from a below-median observation. Existing temporal growth remains suppressed.
- Specialty support uses **period vouches added and still valid**, summed as endorsements across current active specialties, not distinct people. Match the existing Premium period trend, including creation bounds, link creation by generated_at and maintained evidence validity. This is an approved period-based definition distinct from Standard's all-time current support snapshot. Unvouch/invalidation/deactivation can revise results. Cached counts, Discovery Score and weight/reputation scores are not used. Zero-support businesses remain in the median; different numbers of specialties are not normalized.
- Positive review share uses positive / classified stored labels on current published reviews created in the selected period. Blank/unclassified labels are excluded from the denominator, not treated as neutral. Require at least five classified reviews for the merchant and at least five selected peers each meeting that threshold. Suppress both numerical values/position when either requirement fails; reasons distinguish merchant_sentiment_sample_too_small and peer_sentiment_sample_too_small. Return the eligible peer sample count. Compute the median of individual business shares, **not** a pooled platform percentage or average of rates. A pooled platform share, if ever requested separately, must instead pool counts. Current review state follows the existing documented sentiment-policy discrepancy; no refresh or historical reconstruction is performed.

### Composed JSON payload

```text
data:
  business: owned business identity only
  report_version: "1"
  snapshot_as_of
  results:
    standard: existing sanitized Standard response
    premium:
      visibility: existing Premium visibility response
      pocket: existing Premium Pocket response
      specialties: existing Premium specialty response
      review_insights: existing safe stored-insights response
      review_performance: existing Premium review-performance response
  changes:
    visibility: metric -> existing change object
    pocket: metric -> existing change object
    reply_rate: existing percentage-point change object
  peers: anonymous peer response including metric positions
  key_findings: [{code, message}]
  recommended_actions: [{code, message}]
  meta
  measurement_note
```

The report composes service calls directly, without internal HTTP requests or LLM calls. One resolved AnalyticsPeriod/generated_at is passed to every section. Source reads are sequential and not a cross-database transactional snapshot; concurrent data changes can affect reconciliation. Preserve subsection metadata. Stored summaries keep their own coverage dates and generation state, not the selected analytics range. Overall metadata stays partial and records partial section names; it never promotes unverified tracking to complete coverage.

Deterministic rules use stable codes:

| Code | Condition | Recommendation |
|---|---|---|
| UNANSWERED_REVIEWS | Whole current published backlog has eligible-unanswered reviews | Review backlog and respond where appropriate |
| INSUFFICIENT_SENTIMENT | Selected cohort below classified-review threshold | Wait for sufficient classified data before drawing sentiment conclusions |
| STORED_INSIGHTS_MISSING | No stored summary | Availability disclosure only |
| STORED_INSIGHTS_OUTDATED | Stored state outdated | Check original state/coverage/freshness before using content |
| STORED_CONTENT_UNAVAILABLE | Other stored state fails content gate | Availability disclosure only |
| VISIBILITY_UNAVAILABLE | Owned or peer visibility reads fail | Missing evidence disclosure; no performance recommendation |
| VISIBILITY_COVERAGE_UNVERIFIED | Current tracking coverage is unverified | Coverage disclosure; no growth claim |
| INSUFFICIENT_PEERS | Selected inventory below group minimum | Small-group disclosure only |
| INSUFFICIENT_SENTIMENT_PEERS | Group sufficient but merchant/peer sentiment samples insufficient | Sentiment comparison disclosure only |

No causal diagnoses, low-quality labels, manufactured marketing advice or provider-generated findings are included. PDF rendering/export and frontend design are outside this branch.

### Peer/report verification and remaining integration work

1. Run merchant analytics tests plus shared visibility/date helpers. Cover exactly four/five other peers, same-category selection, cluster fallback, exclusion of the merchant/suspended/future/other-cluster rows, and client threshold overrides.
2. Exercise healthy zero counts, odd/even medians, displayed ties, unequal business review samples and fewer than five sentiment-qualified peers. Check that no metric-specific group fallback occurs.
3. Verify batched peer queries, period boundaries, retained specialty evidence, healthy zeros versus unavailable Mongo, and no peer identity fields in serialized payloads.
4. Test both new routes with Plus enforcement off/on, future server-side entitlement grant mocks, roles, inactive accounts and two owners. Confirm standalone Standard still has no Premium data.
5. Check composed subsection periods/generated_at, fixed weekly sections, visibility interval, stored summary coverage, conservative findings, and unchanged stored summaries on GET.
6. Before deployment: reconcile live Mongo aggregates with tracking fixtures, verify coverage/retention and UTC deduplication, measure full-report cost and peer population scale, exercise real JWT access, validate frontend interpretation and entitlement integration. A real Mongo ping alone does not prove tracking completeness. Production query limits/caching require measured evidence and separate approval.

Automated Mongo tests use the existing read-only in-memory collection; live database behavior and production performance are not established by those results.

### Premium verification

1. With enforcement off, authenticate as merchant A and GET all five routes. Repeat as merchant B with distinct fixtures; each response must contain only its owned business aggregates.
2. Try business_id/user_id/plus query overrides; expect 400. Anonymous, explorer/admin/superadmin, and inactive merchant requests must be rejected.
3. Enable enforcement with mock mode disabled: every Premium route returns 403 PLUS_REQUIRED; Standard remains accessible. With mock mode enabled, verify demo activation/reset for two owners through the real new APIs after approved migration deployment.
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
6. With enforcement off, Standard must still contain no Premium/comparison fields. With enforcement on, Standard remains available; all seven Premium routes require eligible owned demo access under explicit mock mode or deny with PLUS_REQUIRED. Real paid entitlements remain unimplemented.
7. Check that Mongo failure produces null visibility/partial metadata while SQL metrics remain readable. Preserve legitimate healthy zeros.
8. Frontend should display event counts, current snapshots, cohort percentages and cutoff labels distinctly; no trend arrows or Premium numbers should be synthesized from this response.

No frontend is modified. Test execution/results are reported after the separately approved run.
