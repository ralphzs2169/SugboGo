# Offline Pocket control storage

This module stores policy and work metadata only. It does not download anything,
store business snapshots/images, call Pocket APIs, grant offline authentication,
or mount a worker or UI. A completed work row is not proof of offline availability.

## Database and migrations

Native database: `sugbogo_offline_pockets.db`, separate from saved journey storage.
Initialization is lazy, shared, and retryable. WAL and foreign keys are enabled.
An exclusive transaction migrates `PRAGMA user_version` from 0 to 1, creating both
tables and their index before publishing the new version. Version 1 reopens
without resetting records. Unsupported future versions are rejected, never
downgraded. Initialization failure closes the connection and permits another try.
The web adapter rejects without importing native SQLite at runtime.

| Table                     | Identity                               | Stored fields                                                                                                                                            |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline_pocket_accounts` | `api_scope`, `owner_id`                | `clear_generation`                                                                                                                                       |
| `offline_pocket_controls` | `api_scope`, `owner_id`, `business_id` | `cache_intent`, `clear_generation`, `operation_version`, `work_status`, `attempts`, `next_retry_at`, `last_error_code`, `last_completed_at`, `cached_at` |

Controls reference the composite account key. Constraints restrict statuses,
intentions, nonnegative times, safe counters, and suppression/invalidated-state
consistency. A work-status/retry-time index is scoped by API and owner.
No collection ID participates in cache identity. No local row claims to be the
authoritative backend Pocket membership.

`cached_at` is reserved freshness metadata and remains null in this foundation.
Work transitions never populate it. Future snapshot publication must set it
atomically with a real validated snapshot. `last_completed_at` is work history,
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

| Operation                                          | Result                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enqueueConfirmedPocketSave(context, businessId)`  | A genuinely new backend-confirmed save becomes `automatic/pending`. Duplicate active intentions reuse their revision, including running/completed work. |
| `requestOfflinePocketRestore(context, businessId)` | Explicit restoration becomes `restore/pending`. Pending/running work is deduplicated; suppressed, completed, or failed work gets a new revision.        |
| `startOfflinePocketWork(operation)`                | `pending` -> `running`; attempts increments.                                                                                                            |
| `completeOfflinePocketWork(operation)`             | `running` -> `completed`; work-completion time is recorded. No payload availability is asserted.                                                        |
| `failOfflinePocketWork(operation, code, retryAt)`  | `running` -> `failed`; stores a bounded error code and optional retry time. Null retry time disables automatic retry.                                   |
| `retryOfflinePocketWork(operation)`                | Due, retryable `failed` -> `pending`, with a new operation version; attempts/history are retained.                                                      |
| `recoverOfflinePocketWork(context)`                | Interrupted `running` -> `pending`, with a new version and `INTERRUPTED` code. Other states are unchanged.                                              |
| `clearOfflinePocketControlState(context)`          | Increments account generation and every tracked business revision; all tracked intentions become `suppressed/invalidated`. Returns the new context.     |

Reads never create intentions. In particular, finding a remotely saved business
without a local snapshot is **not** an enqueue event. An initial Pocket scan does
not automatically cache historical entries. The caller must distinguish a new
confirmed save from ordinary discovery, repeated reads, or collection edits.
Manual restoration requires the caller to establish current Pocket membership;
this local foundation cannot verify backend membership itself.

Clearing only changes local control state. It persists suppression for tracked
IDs, resets retry eligibility/freshness, and rejects old contexts and work tokens.
Unseen server IDs are not enumerated or individually stored; the absence of an
intention never authorizes their download. Only a fresh explicit restoration or
genuinely new confirmed save can establish a new intention after clearing.
No backend memberships, journey records, files, or business payloads are deleted.

## Extension boundary and limitations

Task 3 can reuse context capture, scoped reads, enqueue/restore, clear, and work
revision/retry/recovery metadata. To publish snapshots, extend this repository so
the existing policy/revision checks and the payload write share **one** exclusive
transaction. Checking a token and publishing in a separate transaction is unsafe.
Likewise, a future physical clearing operation must add payload deletion to the
same policy transaction and separately coordinate file cleanup.

There is no worker lease/heartbeat or scheduler. Call recovery only after the
previous worker is known to have stopped; otherwise recovery intentionally makes
its token stale. The queue orders this JS runtime only. SQLite transactions protect
database atomicity, but multiple app processes/workers require a future lease
protocol. A rolled-back clear is a failure, not a successful clear; callers must
report it and allow retry. Process termination before commit also rolls back.

This module does not register logout deletion or grant cold-start offline access.
Authentication revocation denies access; the same account can read its retained
control policy after authenticating again. These are control records, not yet
downloaded business data. Existing journey authorization and schemas are unchanged.
