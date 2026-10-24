# Direct transit development baseline

This branch adds an explicitly invoked synthetic fixture command and regression tests. It does not change the direct-search SQL, API contracts, mobile screens, merchant registration, offline behavior, or transfer planning. Nothing represents official LTFRB routes or real boarding/entrance instructions.

## Prerequisites and isolation

- Use local PostgreSQL/PostGIS and `DEBUG=True`.
- Application fixtures are allowed only in a dedicated database named **sugbogo_transit_dev**. Django's isolated `test_` databases are also accepted for automated tests. Ordinary database names and remote hosts are refused even with debug enabled.
- Every invocation requires `--confirm-database` matching the actual database name. The command defaults to a preview with no database writes. Only `--apply` creates records.
- Preview lists the planned scenarios; it does not inspect collisions or claim that a later apply will succeed.
- Do not rename a production database to satisfy this guard, seed a shared production service, or treat a TEST/DEV prefix as a publication filter. The existing schema does not separate official and synthetic transit records.
- Existing backend/frontend/Docker processes do not automatically select this database. Your usual backend database remains unchanged unless you deliberately reconfigure that process.

Create a separate empty local PostGIS database named `sugbogo_transit_dev` using your existing PostgreSQL/Docker administration tools. Ensure the PostGIS extension is available. No credentials belong in this document or source control.

In a separate PowerShell terminal, from the repository root:

```powershell
cd sugbogo_backend
$env:DB_NAME = 'sugbogo_transit_dev'
$env:DEBUG = 'True'
& '..\.venv\Scripts\python.exe' manage.py migrate

# Preview only; no records are created.
& '..\.venv\Scripts\python.exe' manage.py seed_transit_direct_baseline --confirm-database sugbogo_transit_dev

# Explicitly populate the isolated development database.
& '..\.venv\Scripts\python.exe' manage.py seed_transit_direct_baseline --confirm-database sugbogo_transit_dev --apply
```

These variables affect this terminal and child processes, not another already-running backend or `.env`. `migrate` above initializes the separate database using existing project migrations; this branch introduces no migrations. Do not run that setup against your ordinary database merely to view synthetic routes.

## What is created

| Records | Purpose |
|---|---|
| Two route codes, `DEV-DIR` and `DEV-GAP` | Forward-only direct route and a disconnected route |
| Two directional variants, five transit points, five ordered memberships | Complete input for real PostGIS matching and map segment extraction |
| Three explicitly fictional destination businesses | Forward, reverse and disconnected searches without moving an existing business |
| Three synthetic merchant owners | Unusable passwords; no seeded login or email is sent |
| One reserved cluster/category and three locations | Minimal business-detail relationships |
| One synthetic landmark near the forward alighting point | Exercise optional landmark context, not a new instruction feature |

The command reports 26 directly managed records on a fresh database. The existing user manager additionally provisions each owner's empty Favorites collection. There are no reviews, vouches, saved business memberships, transfers, fares, photos, operating schedules, or Discovery Scores created by this command. It does not call Google, Cloudinary, AI providers, or the broker.

All names begin with `DEV Transit Baseline`, and the description contains `SugboGo synthetic direct-transit baseline v1.`. Straight sample lines are fictional test geometry, not surveyed or road-following routes.

Repeat runs reuse exact matching records and preserve IDs/timestamps. The command never repairs, overwrites or deletes data. Reserved-name conflicts, modified fixture values, extra memberships, connected transfers, or an incomplete reserved route cause the whole apply transaction to roll back. Other unrelated records are preserved. Concurrent seed runs are serialized by a PostgreSQL transaction advisory lock. Reset experiments by using a fresh disposable database; no cleanup/delete command is provided.

## Reproducible scenarios

The successful apply prints actual business IDs. Do not copy IDs from another database or assume fixed primary keys.

| Destination name | Origin latitude | Origin longitude | Expected search result |
|---|---|---|---|
| DEV Transit Baseline Forward | 10.3100 | 123.8900 | One `DEV-DIR` group, boarding A then alighting C |
| DEV Transit Baseline Reverse | 10.3100 | 123.9100 | Empty `route_options`, reason `no_direct_route_match` |
| DEV Transit Baseline Disconnected | 10.3100 | 123.8900 | Empty `route_options`, reason `no_direct_route_match` |

Route `DEV-DIR` has A (10.3100, 123.8900), B (10.3100, 123.9000), C (10.3100, 123.9100), in that order. Route `DEV-GAP` has D (10.3300, 123.9100) then E (10.3300, 123.9200). Destinations are about 22 meters north of C, A and E respectively. The spacing keeps adjacent test points outside the existing 500-meter matching radius.

Reverse and disconnected cases have nearby candidates at both ends but no forward journey on a common variant. There is no reverse variant and no transfer record. A separate origin at latitude 10.3500, longitude 123.8800 should return `no_nearby_boarding_point`.

## Emulator and API checks

1. Keep the ordinary backend on its current port. Use a separate API URL for the fixture environment, for example port 8001. In the dedicated backend terminal above, generate a session-specific signing key and start the server:

   ```powershell
   $env:SECRET_KEY = & '..\.venv\Scripts\python.exe' -c "import secrets; print(secrets.token_urlsafe(50))"
   & '..\.venv\Scripts\python.exe' manage.py runserver 0.0.0.0:8001
   ```

   Keep this key in the terminal environment only; do not print or commit it. A separate signing key prevents tokens from the ordinary database authenticating a different same-ID user in the fixture database.
2. Sign out before switching environments. Restart Expo in a separate mobile terminal with `$env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:8001/api'` and the project's normal `npm run start` command. Use a fresh emulator/app data if necessary. The ordinary configuration previously pointed to port 8000. Separate URLs keep the existing API-scoped snapshots distinct; they do not make old authentication tokens appropriate for another database.
3. Use a separately created local Explorer account in this database. The synthetic merchant owners cannot sign in. Do not copy production users/credentials into the fixture database. If a fresh database lacks the normal registration prerequisites, configure those through the existing application setup before testing the full UI. Existing initial-data migrations may create their own configuration/admin records; those are separate from the 26 directly managed fixtures.
4. Find the destination by its full DEV name in the ordinary business search, then open Getting There and Jeepney. Discovery ranking is not part of this seed; no score is invented to force homepage placement.
5. Set the Android emulator's location to the scenario coordinates and refresh location. A selected starting point in the app takes precedence over device location, so switch it back to current location before comparing results. Do not assume Google autocomplete can find fictional fixture names.
6. For Forward, verify `DEV-DIR`, A before C, optional Entrance Marker, and a selected map segment from A to C. Review distances as approximate; the fixture is not a walkability test.
7. Repeat with Reverse and Disconnected. Expect a successful empty state, not an API error. Also check a distant origin, denied location, and a failed backend connection as separate states.
8. After testing, stop the dedicated backend and restart Expo with its ordinary API URL. The original backend process and `.env` do not need to change. Existing offline snapshots are not automatically refreshed by rerunning the seed.

For an authenticated Explorer or Merchant, the real endpoints are:

```text
GET /api/explorer/explore/businesses/{business_id}/direct-journeys/?latitude=10.3100&longitude=123.8900
GET /api/explorer/explore/businesses/{business_id}/direct-journeys/map/?route_variant_id={id}&boarding_transit_point_id={id}&alighting_transit_point_id={id}
```

Use the IDs returned by search for map requests. Keep tokens out of terminal logs/documentation. A missing or wrong-role session is not evidence that transit matching failed.

## Automated verification

From `sugbogo_backend`, with the usual local database connection available:

```powershell
& '..\.venv\Scripts\python.exe' manage.py test apps.transit.services.tests.test_development_transit_seed_service apps.transit.services.tests.test_direct_journey_service apps.transit.services.tests.test_direct_journey_map_service apps.transit.services.tests.test_direct_journey_landmark_context apps.explorer_operations.explore_businesses.views.tests.test_direct_journey_views apps.explorer_operations.explore_businesses.views.tests.test_direct_journey_map_views --keepdb --noinput
& '..\.venv\Scripts\python.exe' manage.py check
& '..\.venv\Scripts\python.exe' manage.py makemigrations --check --dry-run
```

Django uses its separate test database; `--keepdb` retains that database for reruns. TestCase fixture writes are rolled back. The existing project test runner isolates Celery messaging and requires explicit provider mocks. No application-data reset, production migration, real AI call or mobile source edit is required.

## Recorded results (2026-10-24)

- The focused command above passed all **64 tests**, including 20 new seeder/baseline tests, against actual local PostGIS. Existing search, map, landmark and endpoint regression tests were included.
- `manage.py check` reported no issues. `makemigrations --check --dry-run` reported no changes.
- All five new Python files passed syntax parsing and whitespace/final-newline checks. No mobile or web source changed; their suites were not rerun.
- A separate local `sugbogo_transit_dev` database was initialized with PostGIS and the existing project migrations. The first seed created 26 directly managed records; a repeat created zero and reused all 26. The ordinary backend database and `.env` were not changed.
- Tests used the existing isolated external-services test runner and `DEBUG=True` for guarded seed tests. No real AI-provider calls were needed.

The emulator setup was subsequently prepared: a separate backend on port 8001, Expo on port 8082 configured with `http://10.0.2.2:8001/api`, emulator GPS at (10.3100, 123.8900), and a separate temporary Explorer account. Its password is supplied privately in the local task handoff, not committed here. Real HTTP login and all three search scenarios passed. These development processes must remain running; restart them if the local session ends. The existing backend on port 8000 and Expo on port 8081 were preserved.

User-reported emulator acceptance: Forward, Reverse and Disconnected all behaved as expected. The supplied Forward screenshot also showed DEV-DIR, A-to-C ordering, zero boarding distance, approximately 2.2 km ride distance, 22 m destination distance and the landmark 11 m from alighting. These observations are separate from the automated test results.

Pending: explicit native map-guide rendering, denied-location/network-failure and offline-cache acceptance checks; the three scenario confirmations do not independently establish those results. Passing API tests and synthetic emulator checks do not establish real-world transit correctness. Official LTFRB data is not needed to validate this synthetic baseline, but is still required (or an explicitly accepted verified alternative) before claiming operational route coverage.
