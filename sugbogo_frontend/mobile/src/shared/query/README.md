# Temporary query persistence

This is automatic last-loaded content for approved Explore homepage queries.
The allowlist contains only Discovery, New Businesses, Recommendations, Discovery
shortcuts, Specialty metadata and filter options. Search, collections, business
detail, map results, Community, inbox, history, merchant and offline-resource
queries remain excluded. Mutations are always excluded. No local cache grants an
authenticated session or changes route guards.

## Explore homepage policies

Feature-owned policies live in
`features/explore/persistence/exploreHomepagePolicies.ts`. Matchers require the
exact single-element keys exported through the existing hooks. Filtered or paged
key variants are excluded. The three feeds use ordinary `useQuery` first-page
responses, not infinite queries. Persist only the first ten items of page one,
in server order, with the existing pagination DTO. Empty successful responses
replace previous snapshots, including on the next cold restoration. No additional
pages are stored. All nested DTO objects strip unknown fields; image URLs and
personalized Pocket/vouch/recommendation metadata remain owner/API scoped.

Discovery, New Businesses, Recommendations, shortcuts and Specialties retain
their existing five-minute freshness and have a 24-hour maximum persisted age.
Filter options retain their existing 30-minute freshness and have a 72-hour
maximum persisted age. Filter options are required for homepage cluster controls;
the full compatible taxonomy DTO is kept because that query also supplies search
filters. No result sets from search/filter routes are approved.

The shared client applies GC defaults to these six families before hydration,
even when Explore has not mounted. Their hooks use the same limits: 24 hours for
the five homepage families and 72 hours for filter options. GC is an in-memory
inactivity timer; persisted expiry is still measured from the original successful
server fetch. Opening a screen, restoring, or saving unrelated metadata cannot
renew that fetch age. Global freshness and GC defaults are unchanged.

The provider restores into React Query before normal observer requests run.
Hydrated data renders without waiting for a request failure. Online stale data
revalidates; offline requests pause while cards remain visible. Task 1 rendering
keeps non-empty cards after refresh failures. No separate feed state is added.
No offline/restored indicator is shown: the foundation exposes fetch age but does
not expose trustworthy restored provenance to the screen. A future UI task can
add that explicitly rather than mislabeling live in-memory content.

No managed image downloads are performed. Native `expo-image` disk caching and
existing placeholders determine whether remote image URLs render offline.

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

Query removal also removes its temporary snapshot, so garbage collection can
shorten retention. New approved families must deliberately configure their own
GC lifetime; do not increase unrelated query lifetimes globally.
Confirmed entity deletions/visibility withdrawals must also remove all affected
query variants. This foundation does not implement those feature-specific rules.

The app must use the exported singleton coordinator so storage operations remain
serialized. Factory injection exists for deterministic tests. Future policies
require their own security, moderation, invalidation, pagination and UX tests.

## Physical-device verification (not run in this implementation)

1. Log in online and open Explore; wait for all homepage sections to load.
2. Navigate away and return. Check the existing in-memory cards and refresh behavior.
3. Force-close and reopen online. Check quick restoration and normal revalidation
   when older than the existing freshness window (five minutes for feeds).
4. Load Explore again, force-close, disable internet and reopen.
5. If the authenticated shell is reachable, check restored cards and metadata
   without a new successful request. Images may use disk cache or placeholders.
6. If startup authentication cannot validate the session and normal Explore is
   blocked, record that expected cold-start boundary. Do not bypass the guard.
7. Reconnect and refresh; verify fresh data replaces restored cards. Log out and
   switch accounts; verify the previous owner's temporary content is unavailable.

Offline cold-start access remains governed by `useRestoreSession`/`useAuthGuard`.
This task does not grant local authentication, add Recent Explore, or expose a
new local-only route. Tests simulate process recreation with an already validated
authenticated shell to prove the data boundary independently of route access.
