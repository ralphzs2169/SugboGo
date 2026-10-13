# SugboGo admin and merchant analytics proposal

Prepared 12 October 2026. Planning only; no application changes. Based on the current local checkout and public primary-source benchmarks. Source inspection confirms capabilities, not deployed data volume, production MongoDB health, or measurement accuracy.

## Product purpose

SugboGo promotes Cebu hidden gems and MSMEs through business discovery, specialty vouches, Pocket saves, reviews, and route planning. Analytics should help administrators understand platform reach, business coverage, discovery distribution, and operational queues. Merchants should understand visibility, explorer interest, specialty support, customer feedback, and useful next actions.

Do not lead with revenue, orders, average order value, confirmed visits, or bookings: the inspected flows do not provide transaction or verified arrival evidence. A route request expresses travel intent; a phone tap does not prove a completed call.

## Current implementation evidence

| Evidence | Implication |
|---|---|
| `sugbogo_frontend/web_app/src/features/admin-panel/pages/Analytics.jsx` and backend `analytics/views.py` | Analytics page renders a heading; general endpoint returns a placeholder message. |
| Admin dashboard `MetricRow.jsx`, `DiscoveryChart.jsx`, `DiscoveryActivity.jsx` | KPI counts, discovery bars, and weekly growth are hardcoded. Preserve the visual structure where useful, replace mock values and unsupported trends. |
| Mobile merchant tabs `analytics.tsx` and `dashboard.tsx` | Both are placeholders; merchant analytics presentation remains to be built. |
| `business/services/visibility_event_service.py` | MongoDB stores IMPRESSION, PROFILE_VISIT, SAVE, deduplicated by explorer, business, event type, and day. Existing aggregation retrieves visibility counts and unique savers. |
| Mobile explore impression hooks and API; backend `pocket_service.py` | Explore surfaces have impression tracking; Pocket creation records a SAVE after commit. Tracking reliability must be validated before launch. |
| `business_pocket_models.py`, `business_vouch_models.py` | Current holdings and specialty evidence are available. Unsave and unvouch delete rows, so current SQL rows alone cannot reconstruct complete historical additions/removals. |
| `reviews/models.py` and `docs/review-insights-api-contract.md` | Text reviews have sentiment labels, moderation states, replies, stored summaries and frequent mentions. No star-rating field exists in the inspected Review model. |
| Merchant application analytics service, README, and tests | Application counts, approval/resubmission rates, persisted SLA results, trends and seven-day history already exist. Reuse their documented definitions. |
| DiscoveryScore model and monitoring service | Current specialty, visibility-gap and combined scores exist; the one-to-one model is not score history. |
| `config/settings.py` | Backend timezone is UTC; current visibility deduplication uses the configured day. A Manila reporting boundary must not silently imply Manila-based event deduplication. |

## External benchmarks and transfer to SugboGo

| Comparator | Official pattern | Appropriate adaptation |
|---|---|---|
| [Google Business Profile](https://support.google.com/business/answer/9918094?hl=en) | Profile views, searches, directions, call-button clicks, website clicks and selectable reporting periods. | Visibility and intent cards with plain counting definitions. Calls and directions remain intent metrics. |
| [Yelp Reporting API](https://docs.developer.yelp.com/docs/reporting-api) | Business page activity and consumer action metrics; batch reporting; distinguishes measured actions from store-visit attribution. | Business engagement reporting and explicit freshness. Do not copy paid-ad attribution when SugboGo has no equivalent evidence. |
| [Tripadvisor Review Performance announcement](https://tripadvisor.mediaroom.com/2015-10-19-TripAdvisor-launches-free-analytics-dashboard-for-accommodations-restaurants-and-attractions) | Review/ranking trends, selectable periods and competitor comparisons. This is a 2015 historical benchmark, not verification of today's exact product packaging. | Feedback trends first; anonymous category/cluster comparisons later, when sample size supports them. |
| [Trustpilot insights](https://business.trustpilot.com/solutions/insights) | Review performance, profile traffic, AI review summaries, topics and peer insights. | Reuse SugboGo Review Vibe and frequent mentions; preserve sampling, freshness and insufficient-data disclosures. |

These sources support merchant-facing patterns. The admin proposal below is a product-specific inference from SugboGo's management duties; it is not a claim about competitors' private admin dashboards.

## Recommended admin analytics

| Priority | Question and metric | Presentation | Data readiness and action |
|---|---|---|---|
| MVP | How broad is the platform? Current active businesses, verified businesses, new explorer accounts, explorers engaging in discovery during period. | Four KPI cards; weekly explorer-registration column chart. | SQL business/account counts plus distinct explorers from visibility events. Label discovery-active explorers precisely; this is not complete app MAU. |
| MVP | Is discovery growing? Impressions, profile visits, SAVE events, distinct engaged explorers. | One selectable line chart plus count cards. | Existing MongoDB events; implement analytics aggregation and validate coverage. Do not sum per-business uniques to get platform uniques. |
| MVP | Where is coverage strong or weak? Active businesses by cluster/category; businesses receiving profile visits divided by eligible active businesses. | Sorted horizontal bars, coverage table, optional map later. | SQL geography/taxonomy plus visibility events. Shows coverage and outreach opportunities; listing count does not measure tourist arrivals. |
| MVP | Which businesses get attention? Profile visits, saves, distinct savers and current specialty support. | Sortable business table, category/cluster filters, drill-through. | Existing sources. Keep a separate low-exposure list so the page does not only celebrate already-popular businesses. |
| MVP | Is onboarding efficient? Pending applications, approval rate, SLA compliance, submissions vs completed reviews. | Existing KPI patterns; grouped weekly columns and aging table. | Reuse existing application analytics, including distinct application versus submission/review-event counting. More approvals are not automatically better quality. |
| MVP | What needs administrator attention? Open reports/disputes, age buckets, completed dispute turnaround. | Queue cards and actionable table; simple status bars. | Current statuses and dispute timestamps support selected aggregates. Validate report history before promising full historical queue trends. Flags are signals, not proven abuse. |
| Next | Are hidden gems sharing in discovery? Percentage of active businesses with exposure; concentration of profile visits; underexposed businesses with strong specialty support. | Coverage KPI and opportunity table; concentration chart only if useful. | Existing events and current scores. Define the business population and low-exposure threshold; do not use Discovery Score as measured visibility or business quality. |
| Later | Do explorers return? Weekly retention and source effectiveness. | Cohort table and source bars. | Define broader engagement events and source attribution first. Existing visibility events can support discovery-specific retention only. |

Admin layout: header/date filters; four summary cards; discovery trend; cluster/category coverage; business performance/opportunity table. Put application and trust detail in secondary sections or existing management screens. Keep dashboard summaries short and link to analytics details.

## Recommended merchant analytics

| Priority | Metric | Presentation | Meaning and next action |
|---|---|---|---|
| MVP | Profile visits and distinct profile visitors | KPI cards and selectable daily/weekly line chart. | How much profile attention the business receives. Event counts are daily-deduplicated; period uniques require distinct explorer aggregation. |
| MVP | Pocket SAVE events; current Pocket holders | Period SAVE card; separately labeled current snapshot. | Saving signals interest. SAVE events do not equal current holders, visits or purchases. |
| MVP | Specialty vouches | Three labeled horizontal bars plus distinct supporters. | Shows which specialties receive valid support. Separate total vouches from people; one explorer can endorse multiple tags. |
| MVP | New published reviews and Review Vibe | Review count card; positive/neutral/negative stacked bar with counts. | Customer feedback distribution. Follow existing eligibility and sufficient-data policy; unclassified reviews do not enter the sentiment denominator. |
| MVP | Frequent mentions and review summary | Ranked mention list with counts, summary and freshness labels. | Helps merchants understand recurring praise/concerns. Sampled mention counts are not full-population counts; overlapping themes cannot be added together. |
| MVP | Unanswered reviews and reply rate | Count card and progress bar linking to merchant reviews. | Actionable merchant workload. Define reply rate on published reviews created in the period; show calculation cutoff. |
| Next | Directions/route requests, phone taps, website taps, transport handoffs | Intent cards and horizontal action bars. | Requires additional instrumentation at actual action points; label attempted/successful handoffs separately. Does not confirm arrival, completed calls or sales. |
| Later | Peer comparison and activity timing | Business vs category/cluster median bars; weekday columns. | Compare only sufficiently large similar groups, disclose sample sizes, exclude own business from peer baseline. Daily-deduplicated event times cannot measure every interaction's hour. |

Merchant layout: date selector; 2x2 grid of profile visits, saves, vouches, new reviews; one trend chart with metric selector; specialty support; Review Vibe and mentions; action list such as unanswered reviews. Keep detailed statistics behind drill-down. Merchant dashboard gives a brief summary; analytics gives explanations and comparisons.

## Definitions to approve before implementation

- Impressions: eligible recorded business-card exposures, using existing qualification and daily deduplication. Not all screen renders or all raw displays.
- Profile visits: recorded PROFILE_VISIT events. Distinct visitors: distinct explorer IDs in the entire selected period, not daily uniques added together.
- Pocket saves: recorded SAVE events in period. Current Pocket holders: current BusinessPocket rows. Do not derive historical unsaves or net growth from SAVE alone.
- Specialty support: use existing valid-evidence rules; distinguish endorsements from distinct supporters. Current specialty counts are snapshots unless event history is added.
- Review volume: eligible published reviews, created in period, at calculation time. Label current-state reporting because later edits/moderation/deletion can change historical results.
- Positive share: positive classified eligible reviews / all classified eligible reviews. Show classified count and existing minimum threshold. Do not average business percentages for a platform aggregate; pool counts.
- Reply rate: eligible period reviews with a merchant reply by calculation cutoff / eligible period reviews. Median first-reply time uses only replied reviews and accompanies unanswered count.
- Discovery activity: distinct explorers with an eligible discovery event in period. Account status ACTIVE and last_login are not equivalent to engagement.
- Application metrics: retain repository definitions; overall current-status rates and period review-event rates have different populations.
- Discovery Score: specialty support plus visibility-gap opportunity boost, not star rating, satisfaction, revenue or actual exposure. Historical score charts need snapshots and configuration context.
- A later conversion funnel must link the same explorer/business journey with ordering and an attribution window. Separate period totals are activity stages, not verified conversion rates.

## Presentation and implementation boundaries

Use existing web Inter typography, mobile AppText/Nunito Sans, SugboGo orange, semantic status tokens, borders, radii, PageHeader, MetricCard, filters and shared table patterns. Admin already uses Recharts; reuse it where suitable. No new design system or arbitrary chart palette.

Line charts show time; horizontal bars compare named groups; stacked bars show sentiment; tables support operational decisions; cards show headline values. Avoid 3D charts, decorative gauges, dense mobile dashboards and unlabeled donuts. Separate very different-volume metrics instead of letting impressions flatten reviews on one scale.

Default to last 30 days with 7/30/90-day and custom ranges. Define Manila reporting boundaries explicitly, retain UTC storage, and document existing UTC deduplication unless a separately approved migration changes it. Compare equal elapsed durations. Use percentage points for rate changes; show no comparison where the prior denominator is zero or evidence is insufficient. Missing tracking is unavailable/partial data, not zero.

Charts need values, units, counts, definitions, keyboard/touch access and a list/table equivalent. Show last updated, data-through date, and incomplete current-day status. Drill-through should preserve filters. Any export should match visible definitions and filters.

Backend should follow existing Django services, serializers, response envelopes and role permissions. SQL holds domain facts; MongoDB holds visibility events. Reuse aggregation and introduce indexes/cache/daily rollups only as volume warrants. Merchant endpoints derive owned business from authentication rather than trusting a supplied business ID. Expose aggregate audience counts, not explorer identities or precise personal locations.

## Delivery sequence and acceptance

1. Agree on metric dictionary, reporting boundaries, populations and MVP layout. Validate deployed tracking start date, MongoDB availability, retention and coverage across explore/profile/Pocket paths. Inventory failed or lost events and clearly label partial periods.
2. Build shared aggregates and admin/merchant MVP endpoints, then connect existing presentation patterns. Use existing visibility events, application analytics and review insights. Do not regenerate AI summaries during analytics requests or imply stored summary windows follow arbitrary date filters.
3. Verify role and ownership access, date boundaries, deduplication, distinct counting, deletion/moderation effects, empty denominators, summary freshness and MongoDB failure handling. Use realistic demo fixtures separately from production results.
4. Add intent tracking, contextual source metadata, history snapshots and retention/peer comparison only after core numbers reconcile and sufficient data exists. Source metadata changes must preserve scoring deduplication and avoid silently changing Discovery Score behavior.

Suggested presentation sequence: product questions; current capabilities/gaps; external benchmark; admin proposal; merchant proposal; chart choices; metric definitions/data requirements; phased scope and acceptance. Lead with: "Admin analytics measures whether SugboGo helps Cebu MSMEs get discovered and keeps the platform manageable; merchant analytics explains attention, explorer interest and feedback so owners can act."
