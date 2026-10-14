# Analytics scope, approved decisions, and implementation progress

Decision record date: 14 October 2026 (Asia/Manila).

This documentation branch starts from GitHub main at `e09a923a` after a fast-forward-only pull. It records user-approved product decisions and distinguishes existing backend behavior from approved future work. It does not implement the proposed features or authorize migrations, dependencies, configuration mutations, or application-data changes.

## How to interpret progress

- **Implemented backend:** code and API contracts exist in the inspected checkout; this does not imply frontend integration, live tracking completeness, or production acceptance.
- **Partial / deviation:** useful support exists, but the manuscript's exact requirement is not fulfilled or was deliberately changed.
- **Planned:** an approved product direction requiring a separate implementation task and acceptance evidence.
- **Unverified deployment:** mocks or source inspection cannot establish live operation, performance, or tracking coverage.

The agreed admin/merchant analytics task sequence is implemented and now present on main. Do not describe the entire manuscript analytics scope as 100% complete. Pushed/merged code, automated results, live-data reconciliation, and frontend acceptance are separate evidence categories.

Read this record alongside [the original analytics proposal](analytics-plan.md), [metric definitions](analytics-metric-definitions.md), [admin API contract](../sugbogo_backend/docs/admin-analytics-api-contract.md), [merchant API contract](../sugbogo_backend/docs/merchant-analytics-api-contract.md), and [stored review-insights contract](review-insights-api-contract.md). This record governs approved future product directions; it does not silently change those implemented contracts.

## Approved product decisions

### D1. AI-assisted recommendations over deterministic evidence

**Approved direction; additional recommendation generation is not implemented.** Keep domain services responsible for metric calculations, sample eligibility, comparisons, availability, and factual findings. The existing merchant report's deterministic findings and recommendations remain the dependable fallback. AI may explain qualifying evidence and suggest cautious actions; it must not calculate authoritative metrics or invent causes, sales outcomes, physical visits, or unsupported legal conclusions.

Use Gemini initially because the stored-review pipeline already integrates it. This is an implementation-continuity choice, not a claim of superior model quality. Evaluate an OpenAI alternative using the same approved inputs before switching; an API key alone is not evidence of suitability. Keep provider integration behind an explicit generation service rather than coupling analytics views to a provider.

Generate asynchronously, store validated output, and expose state, source period, evidence/finding codes, configuration version, and freshness. Refresh when relevant source evidence changes; retain stale results only when the evidence remains valid and the stale state is clear. Analytics GET requests must not call Gemini/OpenAI, refresh summaries, or write generated content. Missing/invalid/provider-failed output must not hide deterministic findings.

Generation input should be an allowlisted aggregate snapshot and supported themes, without explorer identities, precise personal locations, document contents, or private moderation evidence. Require structured output and validate its semantics: schema compliance does not prove factual accuracy. Treat user review text as data, not instructions. Do not allow generated recommendations to alter scoring, moderation, eligibility, entitlements, or business status.

Acceptance: evaluate sparse data, unavailable tracking, stale summaries, unanswered reviews, mixed sentiment, Cebuano feedback, and adversarial review text. Check factual consistency, evidence support, invalidation behavior, privacy, useful wording, latency, and cost. Do not choose a provider solely from prose quality. Stored Vibe narrative generation already exists; this future feature adds analytics recommendations and must preserve that existing contract.

### D2. Metric-specific minimums and controlled configuration

**Approved direction; existing hardcoded defaults remain in force until integrated.** Distinguish descriptive counts/rates from conclusions. A healthy count of two recorded visits remains meaningful as a count even when no growth interpretation is permitted. No blanket five-interaction rule will hide all analytics.

| Metric / output | Agreed initial treatment |
|---|---|
| Recorded impressions, visits, saves, current holders/support | Show successful counts, including zero; failures remain null/unavailable |
| Reply rate | Show numerator, denominator, cutoff, and rate when defined; distinguish small samples before recommendations |
| Sentiment conclusion / overall vibe | Retain the existing five-classified-review threshold initially |
| Generated review narrative | Retain five eligible nonblank reviews initially |
| Frequent mentions | Retain support from at least two analyzed reviews and existing sampling disclosure |
| Peer inventory | Retain five other eligible businesses initially |
| Positive-share peers | Retain five classified reviews per business and five qualifying peers |
| Growth conclusions | Require adequate current/prior evidence and verified coverage; sample volume cannot establish tracking completeness |

Coordinate with Ralph's configuration page. Backend policy must define units, allowed ranges, defaults, authorized editors, change audit, and a version/effective timestamp. APIs and background generation must use the same policy source and record its version in generated results. Historical generated content must not be relabeled as if created under a new threshold. Privacy-sensitive disclosure policies need reviewed safety floors; do not allow arbitrary client overrides.

Tracking completeness is evidence-based, not a configuration checkbox. The existing admin and merchant comparison helpers have different historical sample rules; this decision does not automatically harmonize them. Inventory and test every consumer before making thresholds dynamic, including Vibe content gates, peer disclosure, background generation, and report findings.

Benchmark context: [Airbnb rating display](https://www.airbnb.com/help/article/1257) and [Guest Favorites eligibility](https://www.airbnb.com/help/article/3495) use different count/recency rules for different outputs. These examples support feature-specific eligibility; they do not establish SugboGo's statistical thresholds.

### D3. Approval, evidence review, listing status, and entitlement are distinct

**Approved terminology/access policy; evidence-review enhancements require separate implementation.** The current onboarding submission validator requires a business-registration document; the document update flow prevents removing the last required registration without replacement. Approval creates a permanent active business and merchant role. It does not currently set `BUSN_IS_VERIFIED`. An uploaded file is not automatic proof of authenticity or government validation.

| Concept | Meaning |
|---|---|
| Documents submitted | Required evidence was supplied |
| SugboGo application approved | The existing administrative onboarding decision accepted the application |
| Documents reviewed | Evidence was assessed against a documented checklist, with reviewer/date/outcome/reason |
| Active / suspended listing | Current platform listing eligibility |
| Premium entitlement | Access to additional analytics features; no legitimacy or Featured badge |

Continue using **Approved businesses** in admin analytics. Do not backfill the dormant verification flag or add it to access predicates without an agreed definition and lifecycle. Define a human-review checklist for business identity, location, applicant authority, document consistency, and re-review triggers. Preserve evidence privately; do not include documents or sensitive document identifiers in analytics responses. Do not claim that manual review guarantees legal status.

If a badge is added, match its wording to the review actually performed, for example **Reviewed by SugboGo**, rather than **Government verified**. Existing approvals must not be automatically reclassified as reviewed under a new checklist. Keep authenticated active merchant owners' read access to their owned analytics when the listing is suspended, with status disclosure; listing suspension does not grant other owners access. Premium gates still apply.

Recommended manuscript wording: authenticated merchant with a SugboGo-approved listing, with documented suspended-owner read access. This supersedes the ambiguous active/verified precondition for the approved analytics policy, but updating the manuscript itself is separate work.

Benchmark: [Google video verification](https://support.google.com/business/answer/14271705?hl=en) considers location, business existence, and management authority. SugboGo's document process should state what it checks rather than presenting file upload as equivalent verification.

### D4. Graduation is a reversible discovery-priority review

**Planned; no automatic score change or graduation workflow exists in these tasks.** Graduation means sustained sufficient observed discovery exposure can make a business a candidate for administrator review of reduced underexposure priority. It does not mean removal, suspension, permanent exclusion, or a business-quality conclusion.

Require reliable evidence across multiple completed periods, show the supporting measurements, and retain reviewer/reason/date. Allow reassessment if exposure later falls. Choose numerical thresholds after live-data reconciliation rather than presenting invented values as industry standards. Do not implement score-policy changes within analytics or treat suspicious flags as proven abuse.

### D5. Featured is separate, curated, and time-bounded

**Planned.** Featured is a curated collection with eligibility rationale, approval/audit, review date, duration, and rotation. It is independent of graduation and Premium purchase. Payment or mock activation must not grant automatic placement, priority, verification, or a quality badge. Entry/expiry and reassessment need a separately approved workflow.

Benchmark: [Airbnb Guest Favorites](https://www.airbnb.com/help/article/3495) illustrates multiple factors and recurring evaluation. Its booking/star-rating factors cannot be copied into SugboGo, which does not have those same measurements.

### D6. Merchant heatmap is time-based recorded engagement

**Planned.** The first merchant heatmap shows recorded profile visits by Manila weekday and hour, scoped to the owned business and selected period. Use existing event timestamps; preserve UTC-day tracking deduplication. This reveals attention to the listing, not customer arrivals, audience residence, or the best physical opening hours.

Disclose sparse samples, incomplete periods, source failures, and unverified coverage. An omitted or failed bucket must not become a false zero. Configure any conclusion threshold separately from count display. Do not collect precise explorer locations for this feature. Clarify the manuscript's merchant engagement-heatmap wording accordingly.

### D7. Admin heatmap is geographic activity at business locations

**Planned.** Aggregate recorded profile visits initially, with later metric selection where definitions support it, using business locations and agreed geographic cells/areas. Keep a legend and table equivalent. Business locations are current-state anchors; moving a listing can revise attribution unless historical location evidence exists. Do not infer explorer movement or actual tourist foot traffic.

Cluster/category are taxonomy filters, not geographic districts. District reports require validated boundary/mapping data. Respect configured serviceable boundaries and verify whether Metro Cebu coverage is actually enabled; do not silently expand from Cebu City. Google distinguishes [profile interaction metrics](https://support.google.com/business/answer/9918094?hl=en), including profile views and directions requests, which supports explicit measurement labels rather than arrival claims.

### D8. Mock Premium activation remains a proposed implementation task

The manuscript excludes integrated real-time payment processing. Proposed demo activation must accept no money, card/bank details, or real transaction claims. Existing `HasMerchantPlus` is implemented, but enforcement off permits previews and enforcement on currently fails closed for all merchants. There is no persistent per-merchant entitlement yet.

Proposed status, mock-activation and mock-reset APIs should derive the owned business from authentication, grant only after simulated success, preserve existing access after failure/cancellation, and make repeated success idempotent. Explicit mock mode must control mutation availability and whether mock grants count toward enforced access. Demonstrate denial, activation, granted access, and reset with enforcement on. Production enforcement must not accept demo entitlements when mock mode is disabled.

A persistent demo entitlement model/migration is a separate approval decision. No pricing-plan model, payment integration, migration, or activation endpoint is implemented or approved for execution by this docs branch.

## Manuscript traceability

Source: the user-provided `capstone 1 na manuscript.pdf`. Locators below give printed page and PDF page to avoid ambiguity. The audit covers the written requirements and interface descriptions, not a pixel-by-pixel sign-off of diagram mockups. Some UC heading/ID numbering differs internally; use table titles as the stable reference. Document review is not deployment acceptance.

| Written requirement / locator | Implementation evidence | Status and remaining work |
|---|---|---|
| MOAD performance monitoring; Table 17, printed 83 / PDF 96 | Standard and Premium merchant services, trends, report and owner-scoped views | Implemented backend; frontend/live-data acceptance outstanding |
| Profile visits, vouches, specialty performance; Table 17 | VisibilityEventService, Standard support, Premium retained specialty trends | Implemented with current-state and deletion-history limits |
| Navigation starts; Table 17 | Existing events are IMPRESSION/PROFILE_VISIT/SAVE | Planned instrumentation; no navigation-start analytics yet |
| Vibe Summary and themes; Table 17 / Figure 45, printed 117 / PDF 130 | Safe stored-insights serializer/service and existing generation pipeline | Implemented stored reads; preserve coverage, state, sampling and freshness |
| Fewer than five interactions placeholder; Table 17 | Different review/peer policies exist; count display is not globally hidden | Approved deviation: D2 metric-specific eligibility; manuscript wording should change |
| Active, verified MSME precondition; Table 17 | Active merchant role + owned business; suspended listing read access; approval does not set dormant verified flag | Approved deviation: D3; reviewed-evidence lifecycle is future work |
| AI-driven growth suggestions; Figure 45 | Deterministic report findings/actions and existing AI review narrative | Partial; D1 adds separately stored AI-assisted analytics recommendations |
| Visibility alerts against local traffic; Figure 45 | Anonymous category/cluster recorded-event comparisons | Partial; virtual activity does not measure physical traffic |
| Platform growth/community health; Figure 55, printed 127 / PDF 140 | Admin overview, discovery, coverage, onboarding and attention queues | Implemented backend; frontend and live-data reconciliation outstanding |
| Trending MSMEs by vouch/insight growth; Table 22, printed 88 / PDF 101 | Attention and low-exposure lists | Partial; these are not a growth-based trending list; durable history needed |
| Discovery Score distribution across districts; Table 22 | Existing stored-score list/filter/recompute support preserved | Partial existing support; no district distribution/history added by analytics tasks |
| Graduated/Featured collection; Table 22 | No analytics graduation/Featured workflow | Planned under separate D4/D5 policies; thresholds/governance not yet specified |
| PostgreSQL/MongoDB reliability; Table 22 continuation, printed 89 / PDF 102 | SQL domain records, Mongo visibility aggregates, availability metadata/tests | Live verification outstanding; reviews/summaries currently use PostgreSQL, unlike manuscript database wording |
| Discovery funnel views to Pocket saves; Figure 55 | Separate visits and SAVE totals | Planned ordered/attributed journey measurement; totals alone are not conversion |
| Geographic Discovery Heatmap; Figure 55 | Business PostGIS locations, visibility events, cluster/category coverage | Planned D7; taxonomy coverage is not the heatmap |
| Merchant engagement heatmaps; functional decomposition, printed 59 / PDF 72 | No merchant weekday/hour heatmap endpoint | Planned D6; agree manuscript interpretation explicitly |
| Stakeholder/district reports and PDF/CSV; Table 25, printed 92 / PDF 105 | Merchant JSON report only | Admin report/export outstanding; merchant report is not fulfilment of admin use case |
| Offline SQLite route persistence; scope, printed 6 / PDF 19; read-only limit, printed 7 / PDF 20 | Existing route screens/network checks; no established saved-route acceptance evidence | Planned user-initiated persistence; verify app restart in airplane mode |
| Integrated real-time payments excluded; scope limitations, printed 7 / PDF 20 | No payment integration | Aligned; D8 simulation must remain clearly labeled |

The broader MOAD/AOEA module lists (printed 173 / PDF 186) also include profile/lifecycle management, activity oversight and score monitoring. Those are separate feature areas, not automatically completed by the analytics branches. Their own acceptance evidence is required.

## Implementation inventory

| Area | Inspected backend capability |
|---|---|
| Foundation | 7/30/90/custom periods, Manila bounds, equal elapsed prior windows, comparison helpers, metadata, read-only scoped Mongo aggregates |
| Admin overview/discovery | Active/approved snapshots, explorer registrations, discovery-active explorers (not total app MAU), selectable sparse trends |
| Admin coverage/attention | Current active cluster/category coverage, filtered/sorted/paginated business attention, fixed last-30-completed-days low exposure |
| Admin operations | Unchanged native onboarding statistics plus weekly operational events/aging; open queues and completed-dispute median |
| Merchant Standard | Visits/whole-period visitors, recorded saves vs current holders, valid support, published reviews, whole unanswered backlog, cohort reply rate |
| Merchant Premium | Visibility/Pocket trends, retained specialty trends, safe stored insights, pooled sentiment/reply performance |
| Peer/report | Five-peer category/cluster selection, anonymous medians, positive-share sample policy, composed sections and deterministic findings/actions |
| Gate | Separate Premium views use HasMerchantPlus; fail-closed enforced stub, preview bypass when enforcement off |

Known definitions remain explicit: current active/approved business inventory has no historical snapshot comparison; approved onboarding is not the legacy verified flag. Low exposure uses at most four recorded visits and at least five distinct valid supporters over the last 30 completed Manila days and remains provisional. Onboarding's approved legacy UTC/native window exception is retained. Visibility temporal growth is suppressed while coverage is unverified. Stored review insights keep their own window. Public review summaries remain public; Premium expands analytics rather than making existing public fields exclusive.

## Verification evidence and outstanding acceptance

The recorded peer/report branch verification ran **226 tests successfully**, including **28 new peer/report tests**, with Django checks, Python syntax checks, whitespace checks, and disposable PostgreSQL/PostGIS test database cleanup. This was a prior task run, before this documentation branch pulled latest main. It is **not** evidence that all 226 were rerun on `e09a923a`, nor a claim that the entire repository suite passed. Mock Mongo outage logs were intentional simulated tests, not live outage exercises.

Main now includes additional review/community/moderation changes. They were pulled, not reimplemented or migrated by this branch. Keep published-state and retained-evidence semantics aligned with [review moderation/integrity](review-moderation-and-integrity.md) and [review reliability](review-reliability.md); advisory flags do not establish abuse. Run relevant combined regressions during the next approved verification task.

Required remaining evidence:

1. Reconcile known live impression/visit/SAVE events with current/prior totals, period uniques and buckets; verify UTC deduplication vs Manila reporting, failures, retention and indexes/query plans.
2. Establish an evidence-based tracking coverage policy. A ping, first event timestamp, or administrator switch does not prove continuous capture. Never convert missing tracking into zero.
3. Exercise real JWT requests with active/inactive admins, two merchant owners, missing businesses, enforced Premium, demo grants/reset and client overrides.
4. Verify stored summary states/sampling/invalidation and safe current published-review reporting against latest moderation behavior.
5. Measure full-report/peer population cost before approving index/cache/rollup changes; no measured production performance exists from mock tests alone.
6. Integrate frontend loading/empty/partial/unavailable/insufficient/locked states, metadata, units, denominators, and cutoff labels; verify displayed values against manual calculations.
7. Validate export parity and saved offline behavior once implemented. Distinguish healthy recorded zeros from absent tracking and absence of real-world activity.
8. Record review checklist and user acceptance evidence. Keep demo fixtures/results separate from production-data conclusions.

Do not add test totals across overlapping runs and present them as unique coverage. Do not assign a manuscript-completion percentage without an agreed denominator and acceptance rubric.

## Proposed delivery order

This is a dependency-based planning sequence, not authorization to execute future branches. Each task begins with read-only inspection; obtain the required approval for writes, migrations, dependencies, test database changes and application data. Rebase/start from current main after dependency integration; preserve the agreed PR template including Files Changed, Analytics Flow, How to Test, Recorded Results and Notes.

| Order | Proposed branch | Scope and completion evidence |
|---|---|---|
| 1 | `docs/analytics-scope-traceability` | This decision/progress record; documentation-only |
| 2 | `feat/merchant-plus-mock-entitlements` | Server-owned persistent demo entitlement and status/activation/reset; enforce deny/grant/reset; model/migration needs approval |
| 3 | `chore/analytics-live-mongodb-verification` | Reconcile live event capture/read behavior, coverage limits and query performance; propose fixes/indexes separately |
| 4 | `feat/offline-route-cache` | Lead-prioritized user-initiated SQLite saved guidance; inspect existing payload before adding an API; airplane-mode restart acceptance |
| 5 | `feat/analytics-policy-configuration` | Backend policy contract coordinated with Ralph's UI, audited changes/ranges/safety floors/versioned consumers; preserve defaults initially |
| 6 | `feat/merchant-analytics-ai-recommendations` | D1 background stored evidence-grounded suggestions, semantic validation/evaluation, invalidation and deterministic fallback; no generation on GET |
| 7 | `feat/analytics-geographic-aggregation` | Agreed grid/area definitions and location-quality handling; district names require verified mapping/boundaries |
| 8 | `feat/admin-analytics-discovery-heatmap` | D7 map-ready recorded aggregates/table; reconciliation, geographic filters and unavailable/partial states |
| 9 | `feat/merchant-analytics-engagement-heatmap` | D6 own-business Manila weekday/hour buckets; counts, sparse-data/coverage labels and tests |
| 10 | `feat/analytics-navigation-start-tracking` | Agree navigation-start intent/measurement; record approved mobile actions; no arrival or live-vehicle claim |
| 11 | `feat/admin-analytics-discovery-funnel` | Same-explorer/business ordered attribution and window; reconcile journey counts; no ratio invented from unrelated totals |
| 12 | `feat/analytics-engagement-history` | Durable lifecycle evidence/baseline for vouch additions/removals and dependable trend history; migration decision and no fictional backfill |
| 13 | `feat/admin-analytics-trending` | Growth-based candidates using supported history, valid samples/windows and explained eligibility |
| 14 | `feat/admin-analytics-score-distribution` | Current stored-score geographic distribution; preserve scoring algorithm; do not pretend current rows contain score history |
| 15 | `feat/admin-business-graduation-review` | D4 candidates/audit/reassessment; define thresholds after live evidence; scoring-policy changes require their own approval |
| 16 | `feat/admin-featured-businesses` | D5 curated time-bounded collection/rotation/audit independent of Premium |
| 17 | `feat/admin-analytics-stakeholder-report` | Admin geographic/discovery/supported-trend report JSON; distinct from merchant report; preserve limitations |
| 18 | `feat/admin-analytics-report-export` | Agreed CSV/PDF representation matching report dates, definitions, values and limitations; libraries require approval |
| 19 | `chore/analytics-end-to-end-acceptance` | Latest merged code, real JWT/live sources/frontend/export/config/gate checks and deployment acceptance record |

The configuration and AI/heatmap tasks above extend the earlier roadmap to make the newly approved decisions explicit. If graduation/Featured will not be implemented for the capstone, formally revise/defer the manuscript scope instead of silently marking those requirements fulfilled. Frontend integration can proceed in parallel under Ralph's ownership; it does not remove backend/live-data acceptance dependencies.

## References for decision rationale

These are official examples reviewed during the decision discussion on 14 October 2026, not claims about competitors' private backends or universal thresholds.

- [Google Business Profile performance](https://support.google.com/business/answer/9918094?hl=en): distinguish profile interactions and direction requests from physical visits.
- [Google video verification](https://support.google.com/business/answer/14271705?hl=en): location, existence and management-authority evidence.
- [Airbnb rating display](https://www.airbnb.com/help/article/1257) and [Guest Favorites](https://www.airbnb.com/help/article/3495): feature-specific count/recency and multi-factor recurring eligibility examples.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output) and [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs): structured contracts with application-level validation/evaluation; do not infer factual correctness from JSON shape.
