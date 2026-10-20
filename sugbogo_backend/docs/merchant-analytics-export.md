# Merchant Analytics PDF export

`GET /api/merchant/analytics/premium/report/export/` returns a private PDF
attachment for the authenticated merchant's owned business. Existing merchant,
active-account and Plus permissions apply. Real paid entitlement verification
remains outside this feature; preview and mock access retain their existing rules.

## Selection and evidence

The API keeps its existing 7/30/90/custom date and daily/weekly visibility interval
selection, including the bounded optional `as_of`. The mobile Export PDF action
always asks for 7, 30 or 90 days, independently of dashboard section filters.
It uses daily visibility buckets for 7 days and weekly buckets for 30/90 days.
Manila boundaries, equal elapsed previous periods and partial-day disclosures
remain unchanged. Current snapshots and stored summaries retain their own dates.

The expanded PDF uses the existing composed report plus export-only serialized
discovery sources, route-planning activity, profile timing and actionable review
age counts. The JSON report endpoint's response contract is unchanged. The PDF
also includes retained vouch additions and their absolute comparison, reviews,
replies, specialty support, anonymous peers, deterministic findings and actions,
and source/freshness notes. It does not generate AI content or request new
Business recommendations. Stored review content retains its eligibility gate,
original coverage, generation date and sampling disclosure.

Null values remain unavailable. Unknown source attribution remains visible.
Timing distinguishes outside-period cells, recorded zeros, unavailable values,
calendar occurrences and partial hours, without identifying busiest hours.
Route requests do not establish arrivals. Retained vouch cohorts can change after
removal/invalidation/specialty deactivation. The actionable reply backlog excludes
any retained reply and is distinct from the qualifying-reply cohort measures.

## Delivery and limits

The backend generates synchronously in memory with no saved report or public URL.
Existing limits remain: 366 selected calendar days, 6,000 flattened evidence rows,
1.5 million text characters, 150 pages, 10 MiB. Rendering uses a per-process lock;
busy renderers return a controlled 503. Deployments should validate latency and
worker capacity for expected concurrency. Errors remain JSON even when PDF is
requested. Successful responses use an attachment filename and private/no-store
cache headers.

Mobile downloads through the existing Axios JWT-refresh client as binary data.
It validates the PDF signature, MIME type and size, decodes bounded JSON error
responses, and accepts only a controlled filename. There is no automatic retry,
offline queue or React Query cache containing PDF bytes. Duplicate requests are
guarded and pending downloads are aborted on screen/account changes. Late results
cannot open sharing for a different authenticated session. A Plus denial uses
the existing account-scoped access revocation path.

On Android/iOS, Expo FileSystem writes a temporary cache file and Expo Sharing
opens the system save/share sheet. The file is deleted when that operation settles,
including failures. The user's chosen external app or saved copy is outside the
app's cache cleanup. Web uses a local Blob download and revokes its object URL.
No report is uploaded or published by this flow.

## Runtime and validation

`expo-file-system` and `expo-sharing` are direct SDK-compatible dependencies;
`expo-sharing` is registered in dynamic app config with incoming sharing disabled
by default. Existing native development builds must be rebuilt after installing
the new native package. No database migration is introduced.

Backend export service/API tests use disposable PostgreSQL/PostGIS databases,
synthetic Mongo stores and no providers. Install `requirements-test.txt` for
`pypdf` extraction checks. Frontend tests cover binary transport, error envelopes,
filename safety, duplicate taps, account changes, entitlement denial, native file
cleanup and explicit period selection. Native Android/iOS save/share acceptance
and deployed load/latency checks remain separate from mocked automated tests.
