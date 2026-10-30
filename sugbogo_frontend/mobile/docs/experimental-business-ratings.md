# Experimental Explorer business ratings

## Contract and presentation

Explorer consumes the optional `sentiment_rating` snapshot on the existing business
DTO. The backend exposes it only with `EXPERIMENTAL_BUSINESS_RATINGS_ENABLED`.
No new endpoint, request per card, local scoring formula, or rating sort is added.

The snapshot contains `value`, `contributing_review_count`, `state`, `experimental`,
`provenance`, `scoring_version`, `calculation_version`, `computed_at`, and
`automatic_updates_enabled`. States are `ready`, `insufficient_data`, `pending`,
and `unavailable`. Provenance is `legacy_unverified`, `versioned`, or null.

The live profile quick information and shared BusinessCard variants display the
same component. A numeric value requires a ready snapshot, a finite server value
between 1 and 5, at least five contributing scored reviews, and a valid computation
timestamp. Presentation uses one decimal place and labels the value as AI sentiment
and Experimental. Published review totals and existing vibe badges remain separate.

Missing or null fields render no rating section. Pending, insufficient, and
unavailable snapshots render availability copy without a numeric value. Unknown
counts are not represented as zero. Offline numeric ratings are suppressed.
The existing profile source resolver switches to its saved/recent presentation on
network failure; that presentation has no rating aggregate.

## Refresh ownership

Confirmed publication, successful text edits, and deletion invalidate the existing
detail and card collection queries, including Pocket cards. Where an exposed detail
snapshot exists, a session-scoped receipt guard hides its pre-mutation value.
Pre-mutation requests are canceled before the guard and invalidation are applied.

ReviewDerivedDataSyncProvider shares its existing detail query and timer ownership
with rating refresh. While focused and online, rating polling uses five-second
intervals for at most two minutes after a known mutation. It watches the full window
because publication and sentiment completion can produce separate aggregates.
A server-pending snapshot starts a passive window that stops on a newer completed
receipt. New pending work after a completed window can start another bounded window.
Errors stop rating-only interval polling; focus, reconnect, remount, and manual
refresh retain the existing query recovery paths. Navigation/unmount stops timers.

The receipt guard survives navigation in the same QueryClient/auth session, rejects
older cached receipts after a newer completion, and resets across account/session
changes. It never uses `sentiment_aggregate_included` as rating acknowledgment.
That field continues to describe the existing recent sentiment summary.

The API does not expose aggregate revisions or per-review rating membership.
`computed_at` therefore provides ordering, not proof that a particular mutation or
later inference result is included. Work exceeding the bounded window relies on
later authoritative reads. Review changes without a cached exposed detail still
invalidate the existing reads; they do not create background per-business fetches.

## Persistence and offline data

The existing homepage Zod business projection preserves the optional snapshot and
strips unsupported nested fields. Malformed rating snapshots are dropped without
discarding the feed. Old caches remain readable without a persistence version bump.
Existing account-scoped cache policies remain in effect.

Saved offline Pocket snapshots and recent-business fallback projections are unchanged
and exclude live ratings. Homepage persistence is a cached online discovery DTO;
it does not introduce offline rating synchronization. The local-only Recent Explore
screen explicitly omits ratings from its cached cards, including while reconnecting.
An older ready cache cannot
know about work performed elsewhere until an authoritative refresh.

## Deployment validation

Before development device verification, deploy the existing backend rating
migrations (including lifecycle migration 0030), enable experimental exposure, and
verify worker/Beat execution and reconciliation. This mobile change does not apply
migrations or modify the backend. Scoring remains experimental and uncalibrated
across languages; this phase does not validate or replace the sentiment model.

Focused Jest coverage includes presentation, accessibility, cache projections,
receipt ordering, account isolation, bounded shared polling, publication
invalidation, and existing review/offline regressions. Global TypeScript checking
currently reports 27 diagnostics in unchanged tests; the committed baseline was
checked separately with the same diagnostics. Device layout, screen-reader behavior,
and live worker/API integration still need verification.

The focused nine-suite rating/review/detail/cache run passed 129 tests. The expanded
rating synchronization suite subsequently passed all eight cases, including accepted,
rejected, and photo-only edits and deletion. RecentExplore.test.tsx passed all 14 cases,
including the new local-only rating exclusion. An adjacent RecentExploreReconnect
suite has two existing failures; both reproduce when changed sources are replaced
in memory with their committed versions. Its authentication/remount behavior was
not changed in this phase.

Checks used the installed Jest runner with `--runInBand --runTestsByPath` and
`node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`.
No dependencies, builds, migrations, live inference, or commits were performed.

## File inventory

Created:

- `src/features/explore/types/businessRating.types.ts`: exact optional rating DTO.
- `src/features/explore/utils/businessRating.utils.ts`: numeric presentation validation
  and accessible descriptions.
- `src/features/explore/hooks/businessRatingSync.ts`: bounded session-scoped receipt
  observation and stale/offline presentation guards, without fetching.
- `src/features/explore/components/business-profile/BusinessSentimentRating.tsx`:
  shared profile/card presentation.
- `src/features/explore/persistence/businessRatingSchema.ts`: explicit cache schema.
- `src/features/explore/__tests__/businessRating.test.tsx`: presentation and cache tests.
- `src/features/explore/hooks/__tests__/BusinessRatingSync.test.tsx`: shared polling,
  receipt ordering, invalidation, and mutation tests.
- `docs/experimental-business-ratings.md`: contract and operational limitations.

Modified:

- `src/features/explore/types/exploreBusiness.types.ts`: optional snapshot on existing DTO.
- `src/features/explore/screens/LiveBusinessProfile.tsx`: live quick-information rating.
- `src/features/explore/components/new-businesses/BusinessCard.tsx`: shared card variants
  and parent accessibility labels.
- `src/features/explore/screens/RecentExploreScreen.tsx`: omit ratings from local-only cards.
- `src/features/explore/screens/__tests__/RecentExplore.test.tsx`: local-only cache regression.
- `src/features/explore/hooks/ReviewDerivedDataSyncProvider.tsx`: reuse existing detail
  query, focus checks, and polling ownership.
- `src/features/explore/hooks/useBusinessReviews.ts`: confirmed-mutation refresh/guards.
- `src/features/explore/utils/reviewPublicationSync.utils.ts`: publication refresh/guards.
- `src/features/explore/utils/reviewCache.utils.ts`: cancel stale card reads and refresh
  Pocket collection cards through existing query prefixes.
- `src/features/explore/hooks/exploreBusinessDetailQueryPolicy.ts`: pending/unavailable
  snapshots remain eligible for normal focus/reconnect recovery.
- `src/features/explore/persistence/exploreHomepagePolicies.ts`: preserve optional ratings
  in supported online homepage projections, tolerating old/malformed snapshots.

No files were deleted. Backend files, recent-detail projections, and saved offline
snapshot contracts remain unchanged.
