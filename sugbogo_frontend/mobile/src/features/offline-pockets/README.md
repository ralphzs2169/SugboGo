# Offline Pocket storage

This module stores policy, work metadata, and validated business snapshots. It
does not download anything, store local images, call Pocket APIs, grant offline
authentication, or mount a worker or UI. A completed work row is not proof of
snapshot availability. Remote photo URLs are metadata, never offline-ready images.

## Database and migrations

Native database: `sugbogo_offline_pockets.db`, separate from saved journey storage.
Initialization is lazy, shared, and retryable. WAL and foreign keys are enabled.
An exclusive transaction migrates `PRAGMA user_version` from 0 through 1 to 2.
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
schema version 2. `cached_at` is snapshot freshness, set atomically on publication
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

Reads never create intentions. In particular, finding a remotely saved business
without a local snapshot is **not** an enqueue event. An initial Pocket scan does
not automatically cache historical entries. The caller must distinguish a new
confirmed save from ordinary discovery, repeated reads, or collection edits.
Manual restoration requires the caller to establish current Pocket membership;
this local foundation cannot verify backend membership itself.

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
The future caller must establish membership before creating those intentions,
and invalidate local work when membership is removed.

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

Task 4 can reuse context capture, scoped reads, enqueue/restore, revision/retry/
recovery, snapshot construction/publication/read/list/removal, and account clear.
Future image work must separately coordinate file cleanup and must not interpret
remote URLs or `completed` work as proof of offline image availability.

There is no worker lease/heartbeat or scheduler. Call recovery only after the
previous worker is known to have stopped; otherwise recovery intentionally makes
its token stale. The queue orders this JS runtime only. SQLite transactions protect
database atomicity, but multiple app processes/workers require a future lease
protocol. A rolled-back clear is a failure, not a successful clear; callers must
report it and allow retry. Process termination before commit also rolls back.

This module does not register logout deletion or grant cold-start offline access.
Authentication revocation denies access; the same account can read retained
policies and snapshots after authenticating again. Old session tokens stay
invalid. Data is not encrypted, and storage quotas, staleness policy, server
reconciliation, file lifecycle and offline authentication need later design.
Existing journey authorization and schemas are unchanged.
