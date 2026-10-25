# Transit spatial validation

Branch: `fix/transit-route-spatial-validation`.

## Quick test guide

1. Restart the test backend on port 8001 to load the new Python code. A server started with `--noreload` will not pick it up automatically. Keep its database and signing-key environment unchanged; sign in again if the key changes.
2. In web admin, create a disposable local test direction with two different stops and a path following them. Save should succeed when everything is within Cebu City and aligned.
3. Draw the path backwards or place a stop well away from it. Save should show a field error and preserve the previous data.
4. Try moving a shared stop well off its route. Expect a rejection identifying the affected code/direction. Cancel test edits rather than changing the reserved DEV fixtures.

No database migration is required. This branch does not supply a real 06B trace or certify actual roadside boarding legality.

## Save rules

Admin route creation and partial/full updates now require:

- A nonempty, finite WGS84 LineString with nonzero length and no self-intersection/repeated loop.
- The **entire path**, not only its endpoints, covered by the active Cebu City boundary. Polygon holes are respected. Paths on the boundary are accepted; cross-city paths are not clipped.
- At least two distinct managed stops, with first/last IDs matching the selected endpoints as before.
- Each stop within the city and no more than **25 meters** from the path. The first and last drawing locations must also be within 25 meters of their corresponding stops.
- Stop projections strictly increasing along the drawn path. Duplicate positions or stops ordered backwards are rejected.

The 25-meter rule is an authoring quality tolerance, consistent with the draft reviewed seed policy. It does not change the existing 500-meter passenger search radius, 200-meter landmark radius or five-code result limit. Distance checks use PostGIS geography in meters; traversal uses projections onto the stored WGS84 path.

New standalone stops must have valid coordinates inside Cebu City. Coordinate changes revalidate every direction that uses that stop, including endpoint references and memberships. A failure rolls back the whole stop edit, including a simultaneous name change. Name-only edits and explicitly unchanged coordinates are allowed without revalidating legacy spatial data.

Errors retain the current DRF response envelope and use `geometry`, `transit_point_ids`, `latitude` or `non_field_errors`, so existing editor feedback can display them. No API fields, permissions, models or migrations changed.

## Boundary setup and existing data

Exactly one active boundary must have name `Cebu City`, PSGC `072217000`, and valid nonempty WGS84 geometry. Missing, inactive, ambiguous, empty or invalid configuration fails clearly. Other active cities cannot silently substitute for this boundary.

Before entering new routes, audit the intended database. From `sugbogo_backend`:

```powershell
$env:DB_NAME = 'sugbogo_transit_dev'
& '..\.venv\Scripts\python.exe' -B manage.py audit_transit_spatial_integrity
```

This reports IDs, route codes and errors without inserting, updating, deleting or repairing anything. Add `--fail-on-errors` for a nonzero exit status when issues are found. Boundary setup failures also return a command error. Code-only routes with no directions are not spatial failures; they remain unusable for passenger matching until directions exist.

If the chosen local database is missing the boundary, use the repository's existing data loader, then audit again:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py load_cebu_boundary
& '..\.venv\Scripts\python.exe' -B manage.py audit_transit_spatial_integrity
```

The older loader skips an existing PSGC row and does not repair inactive/invalid/duplicate rows. Inspect its output; a subsequent passing audit establishes readiness. Do not use a guessed bounding box outside tests. Ordinary/shared deployments must review their own audit before rollout.

Existing records are not automatically changed and reads remain available. A legacy invalid direction must be corrected coherently before it can be saved; moving a shared stop cannot silently invalidate another direction. Complex pre-existing invalid networks may need coordinated data repair before strict saves are rolled out. There is no force-save/cleanup mode in this branch.

## Concurrent editing and limits

Variant writes and stop writes acquire the same PostgreSQL transaction advisory lock before reading locations or taking row locks. Referenced stop instances are reloaded inside that lock, and direction uniqueness is rechecked there. This serializes these admin service writes and avoids validating stale serializer coordinates while another admin moves a stop.

The lock does not protect direct ORM/SQL writes, boundary maintenance or external importers that do not acquire it. Coordinate imports and boundary changes with admin authoring. The uncommitted seed tooling is not a dependency of this branch and was not refactored here; its separate import lock remains separate.

These checks establish internal spatial consistency, not operational truth. They cannot establish correct route codes, permitted boarding spots, traffic restrictions, current diversions or walkability. A simple line through buildings may still be geometrically valid. Loops, repeated stops, route auto-snapping, transfer planning, audit repairs and broader-city support remain excluded.

## Verification

Tests use actual PostGIS in the separate `test_sugbogo_cebu_city_dev` database. Shared authoring fixtures use an explicitly synthetic test polygon; it is never loaded into the app database. Older tests now draw paths through their managed stops; the detector's intentionally invalid legacy scenario still injects invalid data directly to test legacy handling.

From `sugbogo_backend`:

```powershell
$env:DB_NAME = 'sugbogo_cebu_city_dev'
& '..\.venv\Scripts\python.exe' -B manage.py test apps.admin_operations.transit_management --keepdb --noinput
& '..\.venv\Scripts\python.exe' -B manage.py check
& '..\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
```

Recorded results (25 October 2026):

- **161 tests passed in 60.468 seconds**: 72 admin tests (including 22 new spatial/concurrency tests), 64 direct-transit regressions and 25 existing draft seed/import/export tests. The seed tests exercised the separate uncommitted tooling in this workspace; production authoring does not import it. The project's existing test runner isolated external-service effects.
- The actual PostgreSQL concurrency test passed: a stop move committed while another editor submitted stale stop instances, and the direction save rejected the now-invalid path without creating a direction.
- Django system check: zero issues. Migration consistency rerun with database access: no changes detected.
- Production syntax/function-docstring checks, new-file whitespace checks and `git diff --check` passed.
- The ordinary database was not modified. The existing Cebu City boundary was loaded into `sugbogo_transit_dev`; the subsequent read-only audit reported 5 stops, 2 directions, zero invalid stops and zero invalid directions. No routes, stops, businesses or accounts were altered by that setup/audit.

User confirmed route drawing works and additional directions can be added under 06B, then authorized the local commit. Explicit manual acceptance of invalid-path/shared-stop rejection messages remains pending; the automated API cases cover rejection but do not independently confirm visual presentation. Mobile source is unchanged; the small web control correction below was added during review.

## Stop reorder control correction

During user review, the renamed intermediate role label was found to hide the existing up/down/remove controls. The web point panel now identifies intermediate rows by their numeric intermediate index instead of their displayed role text. Starting/last stops remain fixed; intermediate stops can swap positions. Reordering stops does not redraw the path, and the new spatial checks still reject a mismatched travel order.

Two regression tests passed: actual panel rendering exposes the intermediate controls while keeping endpoints fixed, and swapping the middle IDs preserves the endpoints and original draft array. Scoped web lint passed; the web production build passed in 2.56 seconds with existing bundle/lottie warnings. This small UI correction is included alongside the backend branch; broader route-editor changes remain in the earlier commit.
