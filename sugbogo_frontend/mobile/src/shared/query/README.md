# Temporary query persistence

This is the foundation for automatic last-loaded content. The production policy
list is empty: no Explore, Community, inbox, history, merchant or offline-resource
query is persisted yet. Mutations are always excluded. No local cache grants an
authenticated session or changes route guards.

## Lifecycle and ownership

`QueryPersistenceProvider` uses TanStack's supported `PersistQueryClientProvider`
and AsyncStorage persister. Query observers wait for restoration before fetching.
Task 1's native lifecycle and mutation defaults remain unchanged.

One dedicated AsyncStorage key, `sugbogo_temporary_queries`, holds at most one
owner/API envelope. The API identity is the exact `EXPO_PUBLIC_API_URL` (or the
existing empty-string convention). Restore requires a validated runtime owner,
matching API identity and current authentication generation. The generation is
never written to disk. The data is ordinary unencrypted AsyncStorage JSON; policies
must not admit secrets, documents or restricted content.

Existing `beginAuthSession` and `invalidateAuthSession` boundaries synchronously
notify the persistence coordinator. Explicit sign-in/replacement and revocation
invalidate the old handle and enqueue removal. Startup uses the `restore` reason:
it preserves disk data until identity validation succeeds, but any failed startup
revokes and discards temporary content. Logout, HTTP refresh rejection, socket
expiry and session-establishment failure already use these boundaries.

All reads, writes and removals share one queue. A write that finishes after
revocation is removed before a replacement session can write. Deferred throttled
writes check authority at execution. Restore checks authority after storage reads
and again in TanStack's synchronous deserialize/hydrate step. Old provider cleanup
cannot remove a newer session's data. A cleanup failure blocks restoration/writes
in that runtime until a subsequent cleanup succeeds. Physical deletion is best
effort when device storage fails; normal network Query operation continues.

Offline Pocket databases, saved journeys, managed covers, suppression and access
grants are neither read nor modified by this subsystem.

## Format and policy contract

The JSON envelope contains `formatVersion`, `policyVersion`, `ownerId`, `apiScope`
and `entries`. Each entry contains `policyId`, `policyVersion`, `queryKey`,
`fetchedAt` and validated `data`. Versions are independent of application and
SQLite versions. Incompatible formats are discarded; no migrations are attempted.
Increment an individual policy version when its stored DTO becomes incompatible.

A future feature must explicitly supply a key matcher, policy ID/version, finite
maximum age, byte bound, query kind and stored-data parser. Optional projection
runs before validation on successful fetches. A projection must produce a DTO
compatible with the consuming query; do not hydrate a partial detail into a live
detail contract. Infinite policies must specify a positive page bound. Both
`pages` and `pageParams` are trimmed to the same prefix; mismatches are rejected.

Capture observes actual fetch-success events. It ignores manual `setQueryData`,
initial data and hydration updates. Detached confirmed snapshots prevent optimistic
changes, errors, query metadata or mutation state from reaching storage. A failed
refetch can retain the earlier confirmed snapshot. `fetchedAt` is the original
successful fetch time, never the last save/read time. Per-entry age is enforced on
save and restore; TanStack's global maximum age is intentionally not the policy.

## Bounds and future feature integration

Limits live in `queryPersistencePolicies.ts`: 3 MiB of serialized UTF-8 JSON,
512 KiB per entry and 32 entries. Policies can impose tighter entry limits.
Expired/invalid entries are removed first, then newest confirmed entries are kept
within both byte and count bounds. Oversized entries are skipped. Persistence
never clears unrelated AsyncStorage keys. Storage/serialization failures are
development diagnostics, not API/page errors.

No `staleTime` or `gcTime` is changed here. Query removal also removes its temporary
snapshot, so garbage collection can shorten retention. When a feature opts in, it
must deliberately configure that approved query family's GC lifetime if longer
restart retention is desired; do not increase unrelated query lifetimes globally.
Confirmed entity deletions/visibility withdrawals must also remove all affected
query variants. This foundation does not implement those feature-specific rules.

The app must use the exported singleton coordinator so storage operations remain
serialized. Factory injection exists for deterministic tests. Future policies
require their own security, moderation, invalidation, pagination and UX tests.
