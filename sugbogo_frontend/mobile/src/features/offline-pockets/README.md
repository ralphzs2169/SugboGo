# Offline Pocket storage

This module stores policy, work metadata, validated business snapshots, and one
optional managed cover per business. The foreground worker uses existing APIs;
local browsing uses SQLite and app-owned files only. Confirmed Pocket mutations
enqueue or invalidate work independently of their backend result. The module
never grants authenticated backend access. A completed work row is not proof of
snapshot or image availability. Remote photo metadata is never used directly by
offline image components.

## Database and migrations

Native database: `sugbogo_offline_pockets.db`, separate from saved journey storage.
Initialization is lazy, shared, and retryable. WAL and foreign keys are enabled.
An exclusive transaction migrates `PRAGMA user_version` from 0 through 1, 2 and 3.
The original version 1 schema is unchanged. Migration 2 adds snapshots and their
freshness index without resetting existing policies or work. Version 2 reopens
without resetting records. Unsupported future versions are rejected, never
downgraded. Initialization failure closes the connection and permits another try.
The web adapter rejects without importing native SQLite at runtime.

| Table                        | Identity                               | Stored fields                                                                                                                                            |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline_pocket_accounts`    | `api_scope`, `owner_id`                | `clear_generation`                                                                                                                                       |
| `offline_pocket_controls`    | `api_scope`, `owner_id`, `business_id` | `cache_intent`, `clear_generation`, `operation_version`, `work_status`, `attempts`, `next_retry_at`, `last_error_code`, `last_completed_at`, `cached_at` |
| `offline_business_snapshots` | `api_scope`, `owner_id`, `business_id` | `clear_generation`, `format_version`, `fetched_at` (epoch milliseconds), `snapshot` (validated JSON)                                                     |

Controls reference the composite account key. Constraints restrict statuses,
intentions, nonnegative times, safe counters, and suppression/invalidated-state
consistency. A work-status/retry-time index is scoped by API and owner.
No collection ID participates in cache identity. No local row claims to be the
authoritative backend Pocket membership.

Snapshots reference the composite control key. Their index orders fetched time
within an API scope and owner. Snapshot format version 1 is independent of SQLite
schema version 3. `cached_at` is snapshot freshness, set atomically on publication
to the snapshot's fetched time. Work transitions never populate it.
`last_completed_at` is work history,
not freshness, and survives failed replacement attempts.

## Ownership and operation tokens

`captureOfflinePocketContext()` captures the configured API scope, authenticated
owner, runtime session generation, and durable account clear generation. Capture
this context **before** starting asynchronous work that might later enqueue a save.
Do not reacquire a fresh context merely to make an old callback pass validation.

Every public repository operation checks the authenticated owner/API/session,
checks the durable clear generation inside its transaction, and rechecks the
session before commit. Guidance-only local access grants are not accepted.
Calls accept no independently chosen owner or API scope. API scope follows the
existing guidance convention: the exact `EXPO_PUBLIC_API_URL`, or an empty string
when unset. Release builds must configure that URL consistently.

An `OfflinePocketOperation` adds the business ID and durable operation version.
Tokens are ephemeral: never persist their runtime session generation. After
restart, capture a new context and obtain a token with
`getOfflinePocketOperation()`. That read returns null for absent/suppressed rows
and never enqueues work.

All repository transactions share one module-owned promise queue. A failed
transaction rejects its caller without poisoning later operations. SQL arguments
are bound parameters; dynamic assignment fragments are internal constants.

## State transitions

| Operation                                            | Result                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enqueueConfirmedPocketSave(context, businessId)`    | A genuinely new backend-confirmed save becomes `automatic/pending`. Duplicate active intentions reuse their revision, including running/completed work. |
| `requestOfflinePocketRestore(context, businessId)`   | Explicit restoration becomes `restore/pending`. Pending/running work is deduplicated; suppressed, completed, or failed work gets a new revision.        |
| `startOfflinePocketWork(operation)`                  | `pending` -> `running`; attempts increments.                                                                                                            |
| `completeOfflinePocketWork(operation)`               | `running` -> `completed`; work-completion time is recorded. No payload availability is asserted.                                                        |
| `failOfflinePocketWork(operation, code, retryAt)`    | `running` -> `failed`; stores a bounded error code and optional retry time. Null retry time disables automatic retry.                                   |
| `retryOfflinePocketWork(operation)`                  | Due, retryable `failed` -> `pending`, with a new operation version; attempts/history are retained.                                                      |
| `recoverOfflinePocketWork(context)`                  | Interrupted `running` -> `pending`, with a new version and `INTERRUPTED` code. Other states are unchanged.                                              |
| `clearOfflinePocketControlState(context)`            | Increments account generation and every tracked business revision; all tracked intentions become `suppressed/invalidated`. Returns the new context.     |
| `publishOfflineBusinessSnapshot(operation, input)`   | Validates and atomically upserts a snapshot under the current running intention; sets freshness without completing work.                                |
| `getOfflineBusinessSnapshot(context, businessId)`    | Local-only read returning `available`, `missing`, `corrupt`, or `unsupported`.                                                                          |
| `listOfflineBusinessSnapshots(context)`              | Local-only entries, including explicit corrupt/unsupported results; missing businesses have no row.                                                     |
| `removeOfflineBusinessSnapshot(context, businessId)` | Atomically suppresses the business, invalidates its revision, and deletes even corrupted snapshot data.                                                 |
| `assertOfflinePocketWorkCurrent(operation)`          | Verifies the authorized current running revision before another network step.                                                                           |
| `invalidateOfflinePocketWork(operation)`             | Token-bound suppression/deletion after confirmed absent membership; cannot invalidate a newer revision.                                                 |

Reads never create intentions. In particular, finding a remotely saved business
without a local snapshot is **not** an enqueue event. An initial Pocket scan does
not automatically cache historical entries. The caller must distinguish a new
confirmed save from ordinary discovery, repeated reads, or collection edits.
Manual restoration requires the caller to establish current Pocket membership.
The worker independently verifies membership again before caching.

Clearing changes local control state and deletes account snapshots in the same
exclusive transaction. It persists suppression for tracked
IDs, resets retry eligibility/freshness, and rejects old contexts and work tokens.
Unseen server IDs are not enumerated or individually stored; the absence of an
intention never authorizes their download. Only a fresh explicit restoration or
genuinely new confirmed save can establish a new intention after clearing.
No backend memberships, journey records, or files are affected. If any step fails,
the complete transaction rolls back; an unsuccessful clear must be reported as a
failure. A successful clear leaves no snapshot and no old eligible intention.

## Snapshot contract and publication

`createOfflineBusinessSnapshot(detail, fetchedAt)` uses the existing
`ExploreBusinessDetail` DTO. The Zod schema whitelists identity/name,
cluster/category, specialty name/color/icon, description, address/coordinates,
contacts, weekly operating hours, cover URLs and photo metadata. Unknown fields
are stripped recursively, including review aggregates/insights, vouch counts and
user mutation flags. It does not persist reviews, recommendations, or analytics.
The API service, Pocket DTOs and presentation components remain unchanged.

Snapshots contain `formatVersion: 1`, an ISO `fetchedAt` timestamp supplied when
the information was fetched, and `business`. Positive IDs, bounded fields,
finite coordinate ranges, HTTP(S) URLs, supported tag colors, unique weekdays,
API time strings and fetch timestamps are validated. JSON is limited to 1,000,000
characters; this is a payload bound, not an account storage quota. Empty/null
optional API contacts and URLs are accepted. Photo URLs remain remote metadata.

Publication validates before touching SQLite, then checks current authenticated
session, persisted clear generation, non-suppressed intent, business operation
version and running state in the same transaction as the snapshot upsert and
freshness update. Session is checked again before commit. There is no separate
check-then-write window. Eligibility comes from Task 2's confirmed-save/explicit
restore intentions; this module cannot independently verify server membership.
The caller must establish membership before creating those intentions, and
invalidate local work when membership is removed. The worker checks the real
`getBusinessPocketMemberships()` response before fetching details and again
immediately before publication. It validates business identity, positive Pocket
IDs and consistency between `is_pocketed` and the complete selection. Only a
successful valid empty selection triggers token-bound invalidation. A failed
membership request or unavailable detail response never implies removal.

An older fetch cannot replace a newer valid snapshot. Validation/write failures
roll back and preserve previous valid data. A pending, failed, retried or recovered
refresh leaves older usable data readable; readers do not require a completed
work status or equal operation revision. They require the current clear generation
and eligible control state, so invalidated/suppressed residual rows stay hidden.

Every read validates JSON again, including identity and fetched-time consistency
against SQLite columns. Unsupported versions and damaged payloads are reported
with `snapshot: null`, without exposing raw JSON or deleting data implicitly.
They can be explicitly removed by scoped business ID, or repaired by a current
valid publication. List results retain healthy entries alongside damaged entries.
Reads perform no API calls and never enqueue work.

## Extension boundary and limitations

`OfflinePocketSync` is mounted once in the root layout beside notification sync.
Its feature-owned service shares listeners and one promise drain across duplicate
mounts. It subscribes to AppState, NetInfo, and authentication, with an initial
connectivity read. Work runs only while mounted, active, connected and authorized.
It wakes on eligible startup, foreground, reconnect, explicit
`requestOfflinePocketSync()`, and one timer for the earliest persisted retry.
Unchanged connectivity events do not wake it. There is no idle network polling.

The drain processes one job at a time. It captures a scoped context, recovers
interrupted running revisions, selects pending/due failed controls, obtains their
tokens, versions due retries, and atomically claims pending work with the existing
`startOfflinePocketWork()`. Recovery only occurs after the preceding worker has
settled: the shared drain is retained even across unmounts/account changes.
Recovery increments versions, and duplicate claims cannot both succeed.

The worker uses fresh existing API reads rather than React Query cached membership.
It constructs Task 3 snapshots, publishes through the existing transaction, then
records completion. It changes no query defaults, query cache or notification
behavior, and shows no toasts over unrelated successful Pocket mutations.

Network loss, backgrounding, unmount and session changes abort the current request
using an optional AbortSignal on the two existing API read services. Epoch and
repository checkpoints stop subsequent steps even if transport cancellation is
delayed. Tokens retain API scope, owner, session, clear generation and revision.
Old operations cannot publish or invalidate newer intentions. Clearing rejects old
tokens and suppression survives recovery; the worker never discovers/enqueues new
businesses from backend list scans.

`NETWORK_ERROR`, `REQUEST_TIMEOUT`, `UNKNOWN_ERROR` (including non-envelope server
errors) and `RATE_LIMIT_EXCEEDED` use persisted exponential delays: 5, 10, 20 and
40 seconds, with automatic retries stopped once claim attempts reach five.
Validation and other permanent contract errors have no retry time. Foreground
interruptions remain retryable after five seconds regardless of attempt count.
Failed refreshes retain previous valid snapshots. Local storage failures get at
most five delayed recovery attempts; later lifecycle/explicit wakeups can try again.
Timers stop while inactive/offline/unmounted and due work is reconsidered on wake.

## Pocket mutation integration

`pockets/services/pocketOfflineMemberships.service.ts` connects the existing
replacement, individual removal, and collection deletion hooks. The picker and
React Query flag/invalidation helpers retain their existing behavior; neither
performs a second offline integration. Creation and renaming do not affect caching.

The hooks call `preparePocketOfflineChange()` at submission, before asynchronous
query cancellation. It captures the original API scope, owner, session and a
promise for the original durable clear generation. Local capture failures disable
that action's offline effect without rejecting the backend mutation. No delayed
callback reacquires a fresh clear context to bypass suppression.

For replacement, a fresh complete membership read precedes the PUT. A validated
false -> true aggregate transition authorizes automatic caching. True -> true
changes, collection additions, reordering and unknown previous state do not create
work. A genuinely new save invalidates the previous business revision and payload
before creating its new automatic intention in one transaction, using the existing
enqueue/removal helpers. This also rejects callbacks from an older tracked save.

The backend result is acknowledged before local reconciliation, enqueue or worker
execution finishes. Local errors cannot turn committed saves into mutation errors.
`requestOfflinePocketSync()` is called only after an automatic intention is
persisted. The existing singleton deduplicates wakeups and owns all downloads.

A validated final empty membership suppresses work, advances the revision and
deletes its snapshot atomically. Remaining memberships preserve cache state.
`applyOfflinePocketMembershipChange()` checks the original clear generation and
expected business revision in the same transaction. When a negative result races
with worker retry/recovery, cleanup can pin the newer revision and re-read backend
membership once; it never applies the older response to that revision. A stale
positive callback cannot override later suppression or manual restoration.

Collection deletion snapshots all eligible SQLite controls, including businesses
outside loaded collection pages. After the backend result, at most two membership
reads run concurrently. Each cleanup requires a complete authoritative empty
selection; other memberships and unknown/failed responses retain local state.
Suppressed records are skipped. Generation/ownership checks stop obsolete batches.
No collection-page scan or broad business-detail request is used.

Ambiguous `NETWORK_ERROR`, `REQUEST_TIMEOUT` and `UNKNOWN_ERROR` mutation outcomes
trigger authoritative membership reads. The original API failure is still returned
to preserve existing UI handling. No complete membership selection is replayed.
Without a complete successful membership read, nothing is invalidated or enqueued.
Malformed success selections also require a fresh validated read.

Membership-changing operations share a queue scoped by API, owner and session.
Acknowledgement is independent, but later backend writes wait for the preceding
action's local reconciliation, preventing old deletion callbacks from undoing a
later save. Collection reconciliation can therefore delay a subsequent membership
write; it never waits for business downloads or snapshot publication. A new session
has a separate queue, and old-session checks prevent any local effect.

Manual `requestOfflinePocketRestore()` eligibility remains unchanged. Account clear,
snapshot reads and scoped removal are also available. The full Offline Storage
management UI remains outside this task.

If initial local capture/enqueue fails, or the previous aggregate state cannot be
verified, the backend save survives but automatic offline availability is not
guaranteed. Failed reconciliation is conservative and is not a durable retry job.
App termination after backend acknowledgement can interrupt local reconciliation;
the existing APIs provide no atomic backend/local commit. Explicit restoration or
later reconciliation is required for such gaps. No catch-all rescan is introduced
because it would violate persistent suppression.

There is no OS worker, cross-process lease or heartbeat. The singleton coordinates
this JS runtime only; independently executing app processes would need a lease
protocol. Do not call repository recovery from another active scheduler. SQLite
transactions preserve atomicity across termination. A rolled-back clear is a
failure; callers must report it and allow retry.

Backend membership checks and local publication cannot be one distributed
transaction. A remote change after the final check cannot be detected atomically
with the existing API (which supplies no membership revision). The worker neither
polls completed entries nor reconciles arbitrary remote changes to already cached
businesses. Later mutation integration/reconciliation must handle these events.
Existing API error envelopes omit HTTP status; retry classification uses their
verified error codes. Native-device transport/lifecycle verification is still
needed in addition to controlled tests.

## Local browsing (Task 6)

`/offline-routes` remains the Offline Data entry point, with saved jeepney guidance
and a link to `/offline-pockets`. The flat library opens
`/offline-business/[businessId]`. Routes carry business IDs only, never owner IDs.
`useOfflineBusinessSnapshots` reads SQLite using React Query `networkMode: always`,
no automatic retry and no inactive cache retention. Keys include API scope, owner
and session generation. Committed changes advance a shared local query revision, and focus reloads
them. Browsing never calls Pocket or business APIs, schedules downloads, or loads
remote images. Profile sections and specialty chips are presentation-only; contacts
are selectable text and hours describe saved information rather than live status.

`captureOfflinePocketReadContext` pins either authenticated ownership or the
existing local-only grant. Local reads check owner, API scope, session generation,
revocation and persisted clear generation inside the SQLite transaction. All cache
work and normal mutation operations still require authenticated ownership.
`removeUnreadableOfflineBusinessSnapshot` is the sole deletion-only exception:
an authorized local reader can suppress and remove a corrupt/unsupported copy,
but cannot use it to delete healthy data or enqueue work.

Successful publication remembers the owner through the serialized SecureStore
marker lifecycle. On a transport failure during session restoration, the marker
must match this API scope and at least one validated business or journey must
exist before local access is granted. Authentication remains false. A successful
sign-in re-registers retained valid resources for that account; old session
contexts remain invalid. Explicit logout revokes local access immediately.

Removing or clearing resources checks both stores after their transactions finish.
The final usable resource revokes the local grant and deletes the marker. If one
database fails, a verified usable resource in the other can still grant access;
unknown availability fails closed at startup and does not delete a potentially
valid marker during cleanup. Journey marker registration occurs after its write
queue finishes, avoiding a dependency cycle with marker cleanup's resource probe.
Journey tables and schemas are unchanged.

Missing, corrupt and unsupported snapshots have separate recovery states. Raw
corrupt data is never rendered. Old valid snapshots remain readable with a saved
timestamp. Web retains the native SQLite unsupported-platform adapter.

This module does not physically delete Pocket snapshots at logout: revoked sessions
cannot read them, and the same account can read retained data after authenticating
again. Data is not encrypted. Storage quotas, server reconciliation, managed local
photo galleries and full storage management remain later work. Physical-device airplane
mode, font scaling, safe-area and native navigation QA remain necessary alongside
the controlled SQLite and React Native tests.

### Task 6 file inventory

New files (paths relative to mobile `src/`):

- `app/offline-pockets.tsx`, `app/offline-business/[businessId].tsx`.
- `features/offline-pockets/components/OfflineBusinessHeader.tsx`,
  `OfflineBusinessCard.tsx`, `OfflineBusinessContent.tsx`.
- `features/offline-pockets/screens/OfflinePocketLibraryScreen.tsx`,
  `OfflineBusinessDetailScreen.tsx`, `__tests__/OfflineBusinessBrowsing.test.tsx`.
- `features/offline-pockets/hooks/useOfflineBusinessSnapshots.ts`,
  `__tests__/useOfflineBusinessSnapshots.test.tsx`.
- `features/offline-pockets/services/offlinePocketSnapshots.events.ts`.

Modified files (paths relative to mobile `src/`):

- `app/_layout.tsx`.
- `features/auth/hooks/useRestoreSession.ts`,
  `__tests__/useRestoreSessionOffline.test.tsx`.
- `features/auth/utils/authSession.ts`, `__tests__/authSession.test.ts`.
- `features/offline-pockets/services/offlinePockets.service.ts`,
  `__tests__/offlinePockets.test.ts`, `types/offlinePockets.types.ts`, `README.md`.
- `features/offline-routes/screens/OfflineRoutesScreen.tsx`,
  `__tests__/OfflineRoutesScreen.test.tsx`.
- `features/offline-routes/services/offlineAccess.service.ts`,
  `savedJourneys.service.ts`, `__tests__/offlineAccess.test.ts`,
  `__tests__/savedJourneys.test.ts`, `__tests__/savedJourneysSqlite.test.ts`.

## Managed offline covers (Task 7)

Migration 3 adds `offline_pocket_cover_files`. Versions 1 and 2 are unchanged.
Each row contains `api_scope`, `owner_id`, `business_id`, `file_name`,
`remote_source`, `clear_generation`, `operation_version`, and `file_state`.
The primary key is `(api_scope, owner_id, file_name)`; the row references its
business control. A partial unique index permits at most one `ready` cover per
business/account/API. `staging` and `garbage` rows track crash recovery and pending
physical deletion; they are never rendered. Image state is independent of snapshot
freshness and readability.

Files live under:

```text
Paths.document/offline-pocket-covers/<SHA-256 of exact API scope>/<owner ID>/
  b<business ID>-<random UUID>.img.part  # transfer staging
  b<business ID>-<random UUID>.img       # immutable completed file
```

SQLite stores generated basenames, not device-container absolute paths. File URIs
are rebuilt from the current persistent document directory after restart. Strict
basename validation prevents path traversal. Remote URLs never supply path
segments. Only `display_cover_photo_url`, used by the online card and profile, is
downloaded. Raw covers and photo galleries are not fallback sources.

The existing worker publishes validated text first. It reuses a ready cover only
when its exact source URL matches and the managed file still exists. Otherwise it
registers a unique staging record under the current running operation, downloads
with Expo FileSystem, checks nonempty size and native image dimensions, then moves
the file to its immutable name. A 10 MiB per-image cap and 30-second deadline bound
optional image work. Cancellation follows foreground/connectivity/session signals
and committed clearing/removal events.

After downloading, the worker rechecks ownership and backend Pocket membership.
Publication validates the running operation, clear generation, business revision,
staging identity and current validated snapshot's resolved source in one SQLite
transaction. It changes the old ready reference to garbage and the replacement to
ready atomically. Only afterward is the old file deleted. Transient image failures
use the existing bounded retry/backoff metadata (`COVER_DOWNLOAD_FAILED`), while
text remains readable. Permanent HTTP 4xx errors (except 408/429), empty, oversized
or unreadable images complete text-only work without automatic image retries.
An explicit later restore can retry them. No second scheduler is introduced.

Clearing marks every scoped image record as garbage in the same transaction that
suppresses controls and removes snapshots. Final membership removal does the same
for that business; remaining membership preserves its cover. Ready metadata is
inaccessible immediately. Exact-name deletion follows commit and failed deletion
records persist for retry. Active transfers are cancelled, then their unique files
are discarded on settlement. Cleanup can reacquire the newer clear generation
solely to delete garbage within the same still-authenticated session, never to
publish or enqueue work. Recovery, called by the existing singleton only after
old work settles, invalidates abandoned staging rows and retries garbage deletion.
No directory sweeps, cross-account cleanup or saved-journey changes are made.

Logout/account switching follows Task 6's retained-data policy: authorization is
revoked, in-flight publication is rejected and unpublished transfer files are
discarded. Previously committed files stay scoped to their account and are
accessible again only under that account's authorized session/local grant.

The local query adds optional cover URIs without making image errors fail text
reads. `OfflineBusinessCover` renders only `file://` URIs with `expo-image`,
`contentFit="cover"`, no automatic disk cache, and an on-error placeholder. The
placeholder reuses Explore's cluster/store icon, brand tint and opacity. Card
media bounds remain stable, and the hero matches the online profile's height and
rounded lower edge without adding gradients or online actions.

### Task 7 file inventory

New files under `features/offline-pockets/`:

- `components/OfflineBusinessCover.tsx`.
- `services/offlinePocketCoverFiles.ts`, `services/offlinePocketCover.service.ts`.
- `services/__tests__/coverFileSystem.mock.ts` (deterministic file adapter).

Modified files under the same feature:

- `constants/offlinePockets.constants.ts`, `services/offlinePocketsMigrations.ts`.
- `services/offlinePockets.service.ts`, `services/offlinePocketWorker.service.ts`.
- `hooks/useOfflineBusinessSnapshots.ts`.
- `components/OfflineBusinessCard.tsx`, `components/OfflineBusinessContent.tsx`.
- `screens/OfflinePocketLibraryScreen.tsx`, `screens/OfflineBusinessDetailScreen.tsx`.
- `services/__tests__/offlinePockets.test.ts`,
  `hooks/__tests__/useOfflineBusinessSnapshots.test.tsx`,
  `screens/__tests__/OfflineBusinessBrowsing.test.tsx`, and this README.

### Native device verification (pending)

1. Save a business with a resolved cover image while online.
2. Let foreground offline caching complete.
3. Force-close SugboGo.
4. Enable airplane mode.
5. Reopen SugboGo.
6. Open Offline Data, then saved businesses.
7. Confirm the cover displays from a managed local file.
8. Open its offline detail and confirm the cover and text remain available.
9. Inspect network traffic to confirm browsing makes no remote image requests.
10. Clear Offline Pocket data through the repository/test harness until Task 8
    supplies its management screen; confirm images disappear and journeys remain.
11. Reconnect and confirm intentionally cleared content is not re-enqueued.

On physical Android also inspect short/long names, narrow screens, large text,
safe areas, card cropping and the hero. Repeat with no cover, a deleted local file,
a failed refresh, logout/account switch, and clearing during a transfer. Automated
tests use actual SQLite and a deterministic filesystem/native-dimensions adapter;
they do not replace device filesystem/decoder or visual verification.

### Remaining boundaries

Already completed text-only entries are not mass-requeued on upgrade. Images arrive
with a new eligible cache job or explicit restore; suppression stays respected.
Exact URL matching cannot detect changed bytes behind an unchanged URL without a
new server identity/validator. Image retries currently repeat the existing full
business job, including detail/membership checks. Filesystem deletion failures
can leave inaccessible garbage until the next authorized cleanup/recovery. Empty
account directories are harmless and retained. Snapshot data and cover files are
not encrypted; full quotas and storage management remain outside Task 7. Backend
membership checks and SQLite publication remain separate systems, with the same
unavoidable remote-change window documented above.
