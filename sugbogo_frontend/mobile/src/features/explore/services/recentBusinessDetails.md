# Previously viewed business information

This Explore-owned AsyncStorage store is independent of persisted homepage Query
entries, Offline Pocket SQLite, managed covers and saved journeys. No raw detail
DTO is dehydrated into the Query persistence allowlist.

## Projection and storage

`recentBusinessDetailSchema` reuses the actual Offline Pocket business-data schema.
It keeps identity, cluster/category, description, optional merchant access directions, specialty labels/icons/colors,
public address/coordinates/contacts, weekly hours and remote photo metadata.
Nested objects strip unknown fields. Review data, insights, aggregates, vouch
counts/state, Pocket state, ownership and mutation eligibility are absent.

The dedicated key `sugbogo_recent_business_details` contains one envelope:
`formatVersion`, `ownerId`, `apiScope`, `entries`. Each entry has
`projectionVersion`, original ISO `fetchedAt`, `business` and LRU `accessedAt`.
Both format and projection versions are currently 1. Incompatible/corrupt input
is discarded, without migrations or changes to unrelated storage.

Limits are centralized: twenty entries, 48 hours from original successful API
completion, and 64 KiB of serialized UTF-8 JSON per entry including metadata.
This bounds details to approximately 1.25 MiB plus envelope overhead, separately
from the existing homepage cache budget. Expired/invalid entries are pruned before
LRU eviction. Access updates only LRU, never fetch age. Oversized/invalid new data
is skipped. Storage failures do not become API/profile errors; even a failed LRU
write can still return a valid readable entry.

`useExploreBusinessProfile` captures session authority before the request and
asynchronously projects successful detail responses. Persistence does not block
rendering. Hydration/manual Query updates never renew the store's age. The store
validates before writes and after reads; it does not download photos.

## Source selection and server authority

`useBusinessDetailSource` is the single route source resolver:

1. Usable current online Query detail.
2. A readable, matching owner/API/generation Offline Pocket repository result.
3. A valid matching temporary detail.
4. The existing loading or persistent unavailable/Retry presentation.

The resolver reads durable snapshots through `useOfflineBusinessSnapshots`,
including existing local cover resolution. Worker status, `is_pocketed`, and image
completion are never proof of a readable snapshot. Missing, corrupt, unsupported,
or failed Pocket reads fall through. Pocket reads are disabled for live detail.
When an already-needed fallback read finds a durable snapshot, remove the recent
duplicate. No additional cross-store reads are performed solely for deduplication;
some bounded duplicates can exist until then.

The backend's active-business lookup raises DRF `NotFound`; the shared exception
handler exposes `NOT_FOUND`. That response, `PERMISSION_DENIED`, and session/auth
denials block all local presentation on this route. Normal authoritative detail
denials remove the temporary entry and clear retained live data, so subsequent
transport failures cannot revive it. The resolver also removes temporary entries
for denials reported by the shared review synchronization query. Denials are not
retried; ordinary transport failures retain the existing single retry.
`NETWORK_ERROR`, `REQUEST_TIMEOUT` and ambiguous `UNKNOWN_ERROR` permit fallback.
Unrecognized online API decisions are handled conservatively as unavailable.
No new backend denial contract is invented, and durable retention is unchanged.

## Rendering and effects

The route chooses either `LiveBusinessProfile` or `ReadOnlyBusinessProfile`.
Only the live subtree mounts reviews/private review preview, review insights,
similar businesses, specialty vouch/Pocket controls, analytics, review composer,
review synchronization and route-intent/Getting There controls. The read-only
subtree reuses `OfflineBusinessContent` and profile sections; it mounts none of
those live hooks. An existing in-flight live request may finish after a source
change; rendering fallback never starts another live-only request.

Review synchronization previously continued after every navigation unmount.
It now refuses to start/continue that background work when offline or when the
detail query is paused/failed, preventing a fallback transition from starting a
hidden review polling loop. Ordinary successful online navigation retains its
existing bounded continuation behavior.

Recent content has one status line: “Showing previously loaded information”,
with the original update time and the existing information-may-have-changed text.
Pocket content keeps “Device copy” wording. Weekly hours are static schedule rows;
neither source computes “Open now”. Read-only contacts are selectable text. The
normal card/section typography, specialty wrapping, hero proportions and cover
placeholder remain in use. Back navigation respects safe areas and remains
reachable when scrolling. Pull-to-refresh retries only the detail query.

Recent covers opt into normal `expo-image` remote disk caching; a decode/missing
image falls back to the existing placeholder. Pocket covers remain local-only
with their existing managed URI behavior. Temporary photos are never guaranteed
available offline.

## Ownership and lifecycle

Root provider module initialization registers cleanup before startup auth runs.
The existing `beginAuthSession`/`invalidateAuthSession` events revoke handles
synchronously and enqueue deletion on explicit session replacement, logout,
expiry or definitive startup failure. Task 5 transport suspension revokes runtime
write handles while preserving disk for the separate Recent Explore local grant.
Cold restoration preserves disk content until the
existing authentication process validates identity. The store does not grant
authentication or trust a local Offline Pocket access grant.

Every operation checks current authenticated owner, exact API scope, runtime
generation and local revocation epoch. Generations are never persisted as reusable
authorization. A serialized queue orders writes/removals; a write finishing after
revocation is compensated before replacement-session writes run. Old reads cannot
publish into a new session, including same-user relogin. A deletion failure blocks
further cache access in that runtime until cleanup succeeds. Physical removal is
best effort when storage fails, consistent with the Query persistence foundation.

## Verification and device checklist

Deterministic tests exercise projection stripping, format corruption, retention,
LRU/size bounds, account/API/session races, source priority, server denials,
read-only UI, live-subtree exclusion and existing live/Pocket behavior.
Source/layout review covers long text, wrapping, weekly hours, cover failure and
safe-area navigation. Pixel-level small-device/Dynamic Type checks are not run.

Physical-device verification remains pending:

1. Online, open a non-Pocketed profile and wait for its live data to load.
2. Disconnect, navigate away and reopen it. Verify recent wording, static hours,
   selectable contacts, image placeholder and absence of reviews/actions/routes.
3. Try a Pocketed business with a readable snapshot; verify Device copy wording
   and its managed local cover. Unfinished/missing Pocket snapshots must not hide
   a valid recent detail.
4. Reconnect and pull to refresh. Verify a successful live response restores the
   existing live profile, reviews and actions normally.
5. Force-close/reopen within 48 hours. If normal authenticated navigation is
   legitimately reachable, verify matching-account fallback. If offline startup
   blocks Explore, record the existing auth boundary; do not bypass it.
6. Verify authoritative unavailable/permission responses show Retry/unavailable,
   logout/account switching removes temporary content, and covers/long names/hours
   remain usable on a small device and with large system text.

Task 5 adds a separate local reader guarded by the Recent Explore grant; it uses
the same validated projection/limits without authenticated writes. Normal profile
source resolution and auth guards remain unchanged. See `recentExplore.md`.
