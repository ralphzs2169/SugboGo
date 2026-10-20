# My Pockets backend

My Pockets adds private collections around the existing `BusinessPocket` save.
Multiple collections still represent one saved user/business pair, one current
holder, and one recommendation signal. Collection names are the only customizable
metadata; icons, colors, covers, and sharing are outside this API.

## Persistence and provisioning

- `POCKET_COLLECTION`: `PCOL_ID`, `USER_ID`, `PCOL_NAME`, `PCOL_IS_DEFAULT`, and
  creation/update timestamps. Names have a 100-character limit after trimming and
  collapsing whitespace. A functional owner/name constraint makes names
  case-insensitive; a partial unique constraint permits one default per owner.
- `POCKET_MEMBERSHIP`: `PMEM_ID`, collection/save foreign keys, and timestamps.
  Each collection/save pair is unique. A chronology index supports contents lists.
- `BUSINESS_POCKET` is unchanged. Its primary key, user/business uniqueness, and
  timestamps remain the aggregate save contract. Membership moves preserve it.
- Credential registration and OAuth already use `UserManager.create_user`.
  That boundary now creates Favorites in the same database transaction for
  Explorer and Merchant roles, including pending accounts. Admin accounts do not
  receive new Favorites collections.
- Favorites cannot be renamed or deleted through collection services/APIs. Its
  businesses may be removed. Empty custom collections are valid.

Migration `0029_pocket_collections` depends on business `0028` and the swappable
user model. Migration `0030_backfill_pocket_favorites` also depends on users
`0015`. It uses historical models and the migration database alias, provisions
existing eligible users, and associates all existing saves with their owners'
Favorites. Legacy save owners receive Favorites even if their role has since
changed; this preserves their data without granting API access.

Backfill preserves aggregate IDs, both aggregate timestamps, counters, and
historical analytics. Initial membership timestamps copy their corresponding
save timestamps. Work is batched and repeatable without duplicate rows. No live
service, counter adjustment, or SAVE event is invoked. Reversing the data step
does nothing; reversing the schema step drops only the new collection tables.

Deploy the migrations before serving the new user-creation/API code. Schema and
data migration rollback removes collection organization but retains aggregate
saves. Review that tradeoff before reverting after users have created Pockets.

## Authentication and errors

All endpoints require JWT authentication and the existing `HasRole` check for an
active Explorer or Merchant. Collections are always scoped to `request.user`;
the API never accepts an owner ID. Foreign and missing collections return the
same controlled 404. Mixed foreign/missing selections return a `pocket_ids`
validation error without partial writes.

Responses use `core.responses` and `core.pagination.StandardPagination`:

- Successful reads/writes: `{success: true, message, data}`.
- Lists: `data: {items, pagination}`; `page` and `page_size` are supported.
- Validation: HTTP 400, `success: false`, `code: VALIDATION_ERROR`, `message`,
  and field errors where applicable. Structured field errors can be strings or
  lists, matching existing service exceptions.
- Missing resources: HTTP 404 / `NOT_FOUND`.
- Authentication/role failures use the existing 401/403 contracts.

## Collection routes

All routes below are relative to `/api/explorer/explore/` and retain trailing slashes.

| Method | Route | Request | Successful data |
| --- | --- | --- | --- |
| GET | `pockets/` | Pagination query | Paginated collection metadata |
| POST | `pockets/` | `{"name":"Weekend"}` | Created metadata; HTTP 201 |
| GET | `pockets/{id}/` | None | Collection metadata |
| PATCH | `pockets/{id}/` | `{"name":"Day trips"}` | Renamed metadata |
| DELETE | `pockets/{id}/` | None | `{"id":id}` |
| GET | `pockets/{id}/businesses/` | Pagination query | Paginated `ExploreBusinessSerializer` items |
| GET | `businesses/{business_id}/pockets/` | None | Complete membership state |
| PUT | `businesses/{business_id}/pockets/` | `{"pocket_ids":[1,2]}` | Complete authoritative membership state |
| DELETE | `pockets/{id}/businesses/{business_id}/` | None | Remaining membership state |

Collection metadata contains `id`, `name`, `is_default`, `business_count`,
`created_at`, and `updated_at`. Available-business counts exclude suspended
businesses. Overview ordering is Favorites first, then creation time and ID.
Contents order is newest membership first with an ID tiebreaker.

Business items include the existing category, cluster, location, review, specialty,
and saved-state fields. The maintained discovery queryset supplies
`display_cover_photo_url`, resolving a dedicated cover or first usable storefront,
and eager-loads the relationships consumed by existing mobile cards.

## Complete membership replacement

Membership state is always:

```json
{"business_id":42,"pocket_ids":[1,2],"is_pocketed":true}
```

GET returns every selected ID, independently of overview pagination. PUT means
replace the complete selection, not the currently loaded page. The mobile picker
must retain IDs for unloaded rows. Duplicate request IDs are normalized; returned
IDs are sorted. An explicit empty list removes the business everywhere and
returns `is_pocketed: false`. Omitting `pocket_ids` is an error.

Writes lock the owner, then affected business rows. Collection deletion locks its
businesses in ID order. Every Pocket write uses this coordination, including the
legacy endpoints. Successful competing replacements are serialized; the last
committed complete selection wins. There is no client revision/conflict token.

The service applies only added/removed memberships. An unchanged membership keeps
its timestamps. A save is created on the first membership and deleted after the
last. Deleting a custom collection removes only its memberships and aggregate
saves left empty. Deleting an already-absent individual membership is a successful
no-op when both collection and business still exist.

## Availability and analytics

New membership additions require an active business. Existing memberships survive
suspension and reappear in ordinary lists when the business becomes active.
Membership GET, unchanged replacement, and removal remain available during
suspension; adding or moving into another Pocket is rejected. Physical business
deletion cascades its aggregate saves and memberships, leaving collections intact.

Only a newly created aggregate save increments `BUSN_POCKET_COUNT` and schedules
the existing post-commit SAVE callback. Membership moves do neither. Final removal
decrements the count once and leaves historical MongoDB events untouched. Existing
daily event deduplication and analytics failure handling are preserved.

`PocketService.get_current_holder_count` and recommendation queries continue to
read the original unique aggregate records. Merchant reporting's current holders
remain distinct from period-wide recorded SAVE events. Backfill deliberately does
not repair pre-existing counter discrepancies.

All application writes must use the services. Ownership across the two membership
foreign keys and the aggregate/nonempty-membership invariant are service rules;
ordinary foreign-key/check constraints cannot enforce those cross-table rules.
Direct ORM/bulk updates can bypass them, as with other service-owned workflows.

## Legacy endpoint compatibility

`POST businesses/{business_id}/pocket/` adds Favorites while preserving any custom
memberships and an existing aggregate save. It returns the unchanged HTTP 200
payload `{id, business_id, is_pocketed:true}`. `id` is the aggregate save ID, not a
collection ID. Repeated POST when already in Favorites retains the existing 400
duplicate-save message.

`DELETE businesses/{business_id}/pocket/` removes every membership and the aggregate
save. It retains HTTP 200 `{business_id, is_pocketed:false}` and the existing 404
message when no save exists. Unavailable businesses can still be unsaved.

## Mobile integration and review

Keep checkbox drafts local until Done, then submit one complete PUT. Collection
creation is a separate POST; cancelling a selection does not undo that creation.
Apply the returned authoritative saved state rather than blindly toggling it.
Invalidate collection metadata, affected contents, membership selections, Profile
counts, and existing business caches after writes. Use user-scoped keys for these
private resources and preserve cached recommendation ordering when patching flags.

Backend review should cover migrations, default provisioning, lifecycle locking,
analytics preservation, and the contracts above before mobile implementation.
Saved-tab placement and guest browsing remain separate frontend/product decisions.

## Changed file inventory

Paths below are relative to `sugbogo_backend/`.

| File | Responsibility |
| --- | --- |
| `apps/business/models/pocket_collection_models.py` | Collection/membership schema, constraints, chronology index |
| `apps/business/models/__init__.py` | Exports the two new models |
| `apps/business/migrations/0029_pocket_collections.py` | Generated schema migration after business 0028 |
| `apps/business/migrations/0030_backfill_pocket_favorites.py` | Historical-model Favorites and membership backfill |
| `apps/business/services/pocket_collection_service.py` | Provisioning, name rules, owner locks, collection CRUD and counts |
| `apps/business/services/pocket_service.py` | Shared aggregate/membership lifecycle and legacy compatibility |
| `apps/users/models.py` | Transactional Favorites provisioning in the common account manager |
| `apps/explorer_operations/explore_businesses/serializers/pocket_collection_serializers.py` | Collection metadata and input validation |
| `apps/explorer_operations/explore_businesses/services/pocket_collection_query_service.py` | Reuses the current optimized business-card query |
| `apps/explorer_operations/explore_businesses/views/pocket_collection_views.py` | Collection CRUD and paginated contents APIs |
| `apps/explorer_operations/explore_businesses/views/business_pocket_membership_views.py` | Complete-selection and individual-removal APIs |
| `apps/explorer_operations/explore_businesses/urls.py` | Registers the new routes alongside the unchanged legacy route |
| `apps/business/services/tests/pocket_fixtures.py` | Shared real database fixtures |
| `apps/business/services/tests/test_pocket_collections.py` | Provisioning, ownership, constraints, rollback, lifecycle and availability |
| `apps/business/services/tests/test_pocket_membership_analytics.py` | SAVE event retention and unchanged recommendation signals |
| `apps/business/services/tests/test_pocket_membership_concurrency.py` | Concurrent writes on independent PostGIS connections |
| `apps/business/services/tests/test_pocket_migration.py` | Real historical migration, timestamp/counter preservation and repeatability |
| `apps/business/services/tests/test_discovery_score_migration.py` | Creates current account fixtures before reverting schema and restores graph leaves |
| `apps/explorer_operations/explore_businesses/views/tests/test_pocket_collection_views.py` | HTTP contracts, access checks, pagination and card compatibility |
| `docs/my-pockets.md` | Backend contracts, persistence rules and frontend integration notes |

## Validation commands

Run `venv/Scripts/python.exe manage.py check` and
`venv/Scripts/python.exe manage.py makemigrations --check --dry-run` from the
backend directory. No application database migrations are applied by those commands.

The implementation's tests use the existing Django runner with an explicit fresh,
random `test_pockets_*` database name. Before creating it, the validation checks
that the configured server is local PostGIS and that this database does not exist.
Django applies migrations to that disposable database and drops it afterward.
This does not apply the feature migrations to the configured application database.

The targeted suite includes the five new test modules above and these existing
regression modules:

```text
apps.business.services.tests.test_pocket_service
apps.explorer_operations.explore_businesses.views.tests.test_business_pocket_views
apps.business.services.tests.test_visibility_event_service
apps.business.services.tests.test_visibility_analytics_service
apps.business.services.tests.test_display_cover_photo
apps.business.services.tests.test_discovery_score_migration
apps.explorer_operations.explore_businesses.services.tests.test_recommendation_service
apps.explorer_operations.explore_businesses.services.tests.test_recommendation_integration
apps.explorer_operations.explore_businesses.views.tests.test_recommendation_views
apps.merchant_operations.merchant_analytics.services.tests.test_standard_analytics_service
apps.merchant_operations.merchant_analytics.services.tests.test_premium_visibility_service
apps.merchant_operations.merchant_analytics.views.tests.test_standard_analytics_views
apps.users.tests.test_user_manager
apps.authentication.tests.test_register
apps.authentication.tests.test_oauth_error_handling
```

Validation completed on October 16, 2026 (Asia/Manila): 192 tests passed in
204.084 seconds, with no failures or skips. This includes four separate-connection
concurrency tests, a real forward/backfill migration, historical migration
compatibility, the legacy HTTP contracts, and existing analytics/recommendation
regressions. Django system checks reported no issues and migration drift checks
reported no changes. MongoDB behavior was tested with existing fakes/mocks; live
MongoDB availability and the full repository suite were not tested. No mobile UI
was implemented or tested, and no feature migration was applied to the application
database.
