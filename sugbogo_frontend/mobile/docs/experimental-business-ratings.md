# Experimental Explorer business ratings

## Contract and presentation

Explorer consumes the optional `sentiment_rating` snapshot on the existing business
DTO. The backend exposes it only with `EXPERIMENTAL_BUSINESS_RATINGS_ENABLED`.
No new endpoint, request per card, local scoring formula, or rating sort is added.

The snapshot contains `value`, `contributing_review_count`, `state`, `experimental`,
`provenance`, `scoring_version`, `calculation_version`, `computed_at`, and
`automatic_updates_enabled`. States are `ready`, `insufficient_data`, `pending`,
and `unavailable`. Provenance is `legacy_unverified`, `versioned`, or null.

The shared `BusinessSentimentRating` component displays one decimal place. A
numeric value requires a ready snapshot, a finite server value between 1 and 5,
at least five contributing scored reviews, and a valid computation timestamp.
The star is filled `amber[500]` for every score; there is no score-dependent color.
The backend experimental flag/provenance remain intact without visible AI or
Experimental rating labels on these product surfaces.

- Discovery cards: `★ 3.6 (7)`, where 7 is the contributing scored-review count.
  Unrated cards show the published count, including `No reviews yet` at zero.
  All three specialties remain visible and wrap; cards show no vibe badge or
  specialty-vouch heart. Specialty interactions on the full profile are unchanged.
- Profile: the redesigned cover connects to a rounded identity surface. Its hero
  shows a value-only rating beside the name. Hours/distance are inline below the
  classification. The floating stats and standalone rating block are gone.
  Below threshold, the hero omits the rating; total published reviews remain in
  the Reviews section, with a published-count fallback in inline metadata.
- Collapsed profile header: intentionally repeats the value in navigation context
  after the hero scrolls away. Category truncation leaves the rating its own space.
- Reviews navigation: the combined title is `★ 3.6 | Reviews (4.3k)`. The rating
  precedes the title with a subtle divider, matching the original header text
  size. It is not a `headerRight` action. The visible total is compact-formatted;
  accessibility retains the full published count. Unrated titles omit star/divider.
- Merchant profile: reuses the same value-only rating beside the business name.
  Its public rating read shares the Explorer detail key/API, adds no interval
  polling, and does not write a merchant visit into Recent Explore.

Parent discovery-card buttons announce the business identity, relevant visible
metadata, and either the visible rating/contributor count or published-review
metadata. Pending/insufficient/unavailable rating states are not announced when
no rating is visible. The nested compact rating yields accessibility ownership
to the parent, avoiding a second rating announcement. Pocket actions remain separate.

Recent review insights are distinct from the all-time business rating. On the
Reviews collection only, insufficient recent feedback shows **More recent feedback
needed** and **Review insights are based on recent customer feedback, so older
reviews may not be included.** This copy exposes neither internal eligibility
terminology nor the exact threshold. Generated insights still render normally;
the profile's review preview omits this insufficient-data card.

Missing or null fields render no rating. Pending, insufficient, and unavailable
ratings omit the numeric value and show no rating placeholder on cards or headers.
Unknown counts are not represented as zero. Offline numeric ratings are suppressed.
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

Use the current [backend deployment checklist](../../../sugbogo_backend/docs/experimental-business-rating-deployment.md):
apply rating migrations 0029/0030; deploy backend/web code; restart and inspect
workers and their `celery` queue; restart/verify one Beat scheduler; observe
recovery/reconciliation delivery; verify selected scoring versions; enable API
exposure for the intended environment; and verify mobile against that backend.
Neither worker nor Beat auto-reloads code/configuration. The
[historical Phase 6B report](../../../sugbogo_backend/docs/experimental-business-rating-phase6b-runtime-verification.md)
records successful development execution after stale processes were restarted.
It does not certify that services are running now.

Scoring remains experimental and uncalibrated across languages. Development
completion is separate from physical-device acceptance and public-production
readiness. This cleanup does not run migrations, inference, or live fixtures.

## Final development cleanup validation (October 30, 2026)

The final targeted set passed **224 tests across 16 suites**, with no failures or
skips, using `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath`.
The result combines the focused run with successful reruns of changed assertions;
the entire project suite was not run. Coverage includes cards and their sibling
Pocket/navigation actions, hero and sticky ratings, the combined Reviews title,
insight available/insufficient states, offline profile transitions, receipt guards,
and existing bounded synchronization tests.

Affected-file ESLint passed with no errors; two existing `Array<T>` style warnings
remain in the rating test file. Prettier and `git diff --check` passed. The normal
`node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`
command still reports existing project diagnostics. A compiler comparison against
`HEAD`, restoring changed TypeScript files only in memory, found **28 diagnostics
in each version and no new diagnostics**. No unrelated type fixes were included.

Source and component checks preserve the single primary hero rating, omit ratings
below threshold, keep the intended sticky/navigation contexts, preserve the total
published Reviews count, and exercise long names and 320-width card inputs with
larger font scaling. They cannot verify Android pixel layout or TalkBack focus.
Actual device acceptance remains required for long hero names, category truncation,
sticky identity, Reviews-title width, specialty wrapping, and rated/unrated
transitions. No live worker, database, model, or device verification was rerun by
this cleanup. Historical runtime evidence remains in the Phase 6/6B reports.

## Historical Phase 5 validation notes

The results and implementation inventory below describe the original mobile
integration phase, not the final cleanup's test counts or current UI placement.

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
- `src/features/explore/screens/LiveBusinessProfile.tsx`: originally supplied live
  quick-information values; the current rating belongs to `ExploreBusinessHero`.
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
