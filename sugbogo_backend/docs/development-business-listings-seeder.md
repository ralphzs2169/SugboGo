# Development business listings seeder

Inspection date: 2026-10-13 (Asia/Manila).

This command prepares fictional Cebu City listings for manual Explore, business
profile, specialty-vouch and business-grouped Vouch History testing. It uses only
the current checkout's models. It does not import another branch's database.

## Scope and architecture

Explorer discovery, Hidden Gems, New Businesses and business-detail queries
require `BUSN_STATUS=active`. Discovery scores are optional: missing scores rank
as zero. Business ownership is one-to-one with `User`; category and location are
required foreign keys. A category belongs to a cluster. Specialty assignments
are unique per business/tag and use `BST_IS_ACTIVE` for visibility. Merchant
application submission normally requires exactly three distinct specialties;
this command gives every listing three relevant active assignments.

Existing application approval creates the permanent Business and related rows.
Explorer reads and vouch/history queries do not require an application record,
so the seeder creates the permanent development records directly. It does not
call approval or introduce artificial applications or verification documents.

One Explorer can endorse several specialties of the same business. Existing
vouch mutations enforce one row per user/business/tag and reject the owner. The
history endpoint includes only active businesses with active matching specialty
assignments, grouping the user's endorsements under `vouches`. No production
API, scoring or frontend behavior changes for this command.

## Files and reused code

Paths are relative to `sugbogo_backend/`:

- `apps/business/management/commands/seed_development_businesses.py`: explicit
  command entry, controlled errors and created/reused summary.
- `apps/business/services/development_business_seed_service.py`: deterministic
  dataset, development guard, transaction and validated ORM creation/reuse.
- `apps/business/services/tests/test_development_business_seed_service.py`:
  command/data-integrity tests and unchanged Explorer API integration tests.
- `docs/development-business-listings-seeder.md`: usage and manual test handoff.

Reuses `User.objects.create_user`, current business/taxonomy/location/hour models,
`ServiceableBoundaryService.validate_serviceable`, the reputation configuration
status helper, and `OperatingHoursWeekSerializer`. New records undergo Django
model validation. No existing safe business/taxonomy seeder was found. The
analytics demo script creates applications, requires taxonomy and deletes its
previous applications; it is not invoked or repurposed here.

## Prerequisites and invocation

At the initial 2026-10-13 inspection, this command had not been executed against
the inspected development database, which had no business listings or active
boundary. Subsequent local execution is recorded below; it does not describe
every developer's database. The setup instructions remain applicable to new
local environments.

The project's environment convention is `DEBUG`, parsed as the literal string
`True`. The seeder refuses `settings.DEBUG=False` before opening a database
transaction. There is no force/production override, startup hook or migration.
At that initial inspection, the local environment had `DEBUG=False`; enabling
development mode for this command is a separate explicit operator action.

An active service-area boundary must already cover all 15 coordinates. For a
local database without that boundary, load the existing checked-in Cebu City
polygon with `load_cebu_boundary` first; the seeder never loads or changes it.
Every point uses longitude as x, latitude as y, and SRID 4326. All planned points
were checked against the repository's Cebu City polygon, and the command checks
them against the active database boundaries again before creating records.

The existing reputation configuration must be complete. It supplies each new
owner's baseline reputation and allows subsequent normal vouch rewards. The
seeder neither creates nor edits configuration. It was complete at inspection.

After approval, in a terminal dedicated to the local development database:

```powershell
Set-Location 'C:\Users\HP\SugboGo\sugbogo_backend'
$env:DEBUG = 'True'
.\venv\Scripts\python.exe manage.py load_cebu_boundary
.\venv\Scripts\python.exe manage.py seed_development_businesses
```

The DEBUG assignment affects this terminal's processes, not an environment file.
Do not use this workflow against production. The DEBUG guard follows the
repository's convention; it does not independently identify a database as local.

## Dataset

Creates 3 marked development clusters, 6 categories, 18 specialty tags, 15
synthetic owners, 15 locations, 15 businesses, 45 active specialty assignments
and 105 operating-hour rows on an empty development dataset with prerequisites.

All names below have the literal `DEV ` prefix. Categories belong to Culinary,
Creative or Leisure respectively; their exact database names also start `DEV `.
Each category's three specialties apply to all its listed businesses.

| Category | Three specialty names (each also prefixed `DEV `) |
| --- | --- |
| Cafes | Brewed Coffee; Coffee Tasting; Cafe Snacks |
| Bakeries | Fresh Bread; Small Batch Pastries; Celebration Cakes |
| Pottery Studios | Handmade Ceramics; Clay Workshops; Custom Glazes |
| Textile Workshops | Woven Crafts; Fabric Design; Textile Workshops |
| Board Game Lounges | Board Games; Group Games; Logic Puzzles |
| Reading Rooms | Quiet Reading; Book Discussions; Reading Nooks |

| Fictional business name | Category |
| --- | --- |
| DEV Amber Lantern Cafe | Cafes |
| DEV Moonbeam Mug Cafe | Cafes |
| DEV Paper Kite Cafe | Cafes |
| DEV Sunrise Crumb Bakery | Bakeries |
| DEV Little Comet Bakery | Bakeries |
| DEV Clay Cloud Studio | Pottery Studios |
| DEV Pebble Wheel Pottery | Pottery Studios |
| DEV Fern Cup Ceramics | Pottery Studios |
| DEV Woven Sparrow Studio | Textile Workshops |
| DEV Thread Lantern Workshop | Textile Workshops |
| DEV Dice Meadow Lounge | Board Game Lounges |
| DEV Meeple Grove Lounge | Board Game Lounges |
| DEV Boardwalk Puzzle Room | Board Game Lounges |
| DEV Quiet Orbit Reading Room | Reading Rooms |
| DEV Willow Page Reading Room | Reading Rooms |

Owners use reserved deterministic identities in the `.invalid` domain, are
active Merchants, have unusable passwords, unverified email and no administrative
privileges. They are not human login accounts. No existing account is changed.
Business descriptions and fictional addresses explicitly identify development
data. Contact numbers are synthetic placeholders, not numbers to contact.

Each schedule covers all seven days: Monday through Saturday 09:00-17:00, Sunday
closed. The schedule passes the existing weekly validator. Business verification
flags remain false. All new business/assignment engagement counters start at zero.

No photos, cover URLs, Cloudinary public IDs, landmarks, applications, discovery
scores, reviews, vouches, saves or interest/history records are fabricated.
Photos are optional for direct Explorer records; existing image fallbacks apply.
Missing discovery scores do not prevent discovery. Landmarks are optional and
omitted because there is no real venue to describe or route visitors toward.

## Repeat runs and failure behavior

Existing seed businesses are identified by their deterministic owner, name and
description marker. Compatible deterministic taxonomy and synthetic owners are
reused. Ambiguous categories, conflicting taxonomy definitions, owner identities
or business ownership/name collisions cause an error instead of an overwrite.

The command never updates or deletes existing rows. In particular, manually
created vouches, counters, photos, hours and business visibility remain intact on
reruns. It does not reactivate suspended listings or repair manually edited seed
records. Changes to reserved names/identity markers can make a rerun refuse;
resolve the conflict deliberately rather than expecting a reset.

All creation is inside one transaction. A failure after partial creation rolls
back all new rows. Preconditions fail before inserts. Concurrent invocation is
not a supported workflow; uniqueness checks can make one invocation fail safely.

## Manual Task 1 and Task 2 checklist

1. Start the usual local backend and Metro; open the compatible development APK.
2. Sign in as a separate active Explorer. Owners cannot vouch for their business.
3. Refresh Explore. Find a `DEV ` listing in New Businesses or Hidden Gems; open
   its profile and confirm three specialty reactions, location and hours.
4. An Explorer with no prior vouches should still have history totals 0/0.
5. Vouch for specialty A. Profile -> Your Activity -> Vouch History should show
   one business, one nested endorsement and summary totals 1/1.
6. Open Manage Vouch from that card's three-dot control; add specialty B. Expect
   one business card, two endorsements and totals 1/2.
7. Remove A: retain the business and B, totals 1/1.
8. Remove B while keeping Manage Vouch open: the card disappears and totals become
   0/0, but the sheet remains usable.
9. Re-vouch from the still-open sheet: the card returns with a new vouch ID and
   timestamp, totals 1/1.
10. Vouch for other seeded businesses to test newest/oldest ordering and multiple
    pages. Wait for each mutation to settle; also check dismissal/reopening during
    a pending request blocks conflicting presses.

Seeder tests run only in Django's separate test database. They do not validate
phone rendering, live Metro/API networking or provider integrations.

### Subsequent local testing

After the initial inspection, developers successfully loaded the Cebu City
boundary and ran the seeder in one local development environment. It created
15 fictional businesses, which appeared in the Android development APK.
Developers then created specialty vouches manually through the existing APIs;
the seeder did not fabricate them.

Reported APK testing passed business grouping and summary counts, adding/removing
specialties, final-vouch removal and re-vouching from the open Manage Vouch sheet,
Newest/Oldest sorting, infinite pagination, multi-page refresh and mutations
across pagination boundaries. Network-error recovery and delayed mutations with
sheet dismissal/reopening remain optional device checks, not completed manual
verification. See the [Vouch History handoff](explorer-vouch-history-handoff.md)
for the detailed testing record.

These observations concern one development environment. Other developers must
inspect their own prerequisites and existing data before following the setup
instructions; neither the database contents nor execution state is universal.

## Validation results

### Initial validation (2026-10-13)

Executed from `sugbogo_backend/` with the existing Windows virtual environment:

```powershell
.\venv\Scripts\python.exe -B manage.py test `
  apps.business.services.tests.test_development_business_seed_service `
  apps.explorer_operations.explore_businesses.views.tests.test_discovery_feed_views `
  apps.explorer_operations.explore_businesses.views.tests.test_explore_collection_views `
  apps.explorer_operations.explore_businesses.views.tests.test_explore_specialty_views `
  apps.explorer_operations.explore_businesses.views.tests.test_business_detail_insights_views `
  apps.business.services.tests.test_vouch_service `
  apps.explorer_operations.explore_businesses.views.tests.test_business_vouch_views `
  apps.explorer_operations.explore_businesses.views.tests.test_vouch_history_views `
  --noinput
```

Result: **124 tests passed**, zero failures/errors, in **407.495 seconds**:
27 new seeder tests and 97 existing regression tests. Django created and destroyed
its separate test database. No existing test files were modified.

The earlier focused run passed 26 tests in 20.082 seconds; one more ownership
collision case was subsequently added and included in the final combined run.
Initial failures were assumptions in the new tests about a shared URL route name
and the existing vouch POST status. Only those new assertions were corrected:
profiles use the literal Explorer path and vouch POST remains HTTP 200.

Additional results:

- `manage.py check`: no issues, zero silenced.
- `manage.py makemigrations --check --dry-run`: no changes detected.
- All three new Python files passed syntax parsing; production functions have
  docstrings.
- `git diff --check` reported no whitespace errors; the untracked files were
  separately checked for whitespace as well.

No Python linter/formatter is installed in the existing backend environment;
none was installed for this task. Frontend TypeScript/lint checks and the full
backend suite were not run. No failures remain in the selected checks/tests.

At that initial validation stage, read-only development-database verification
after testing found zero businesses, taxonomy, boundaries, merchant applications
and vouches, with the same two existing user records by count. The command was
executed only by the
automated tests at that stage, not against the development database. This
historical snapshot predates the subsequent local testing described above.
Task 1, Task 2 and the pre-existing `MapView.tsx` working-tree contents were
preserved.

### Latest reported validation (2026-10-14)

The eight-module test command above was rerun against the current checkout:
**124 tests passed**, zero failures/errors/skips, in **238.855 seconds**, exit
**0**. This includes **27 seeder tests** and **97 existing regression tests**.
Seeder coverage still includes development protection, idempotency, collision
handling, transactional rollback, preservation of existing data, synthetic
ownership, real Cebu geometry, taxonomy, schedules and no fabricated engagement.

- Django system check passed with no issues and none silenced, exit **0**.
- `makemigrations --check --dry-run` reported `No changes detected`, exit **0**;
  no migration files were generated or development migrations run.
- `git diff --check` passed, exit **0**. A separate non-mutating whitespace
  inspection found no issues in the four untracked seeder files. Git emitted
  informational LF-to-CRLF warnings; captured file hashes remained unchanged.

For this run, Django's standard `DiscoverRunner` used PostGIS with development
database `sugbogo_db` and a separate `test_sugbogo_db`, with no test mirror.
Read-only inspection verified the test database was absent before execution.
Only that test database was created, initialized and destroyed; it was absent
afterward. Before/after row fingerprints matched for the development database's
15 businesses, 10 specialty vouches, one boundary and 17 users. The seeder was
not invoked against development data during validation.

These are results from this reported validation run, not guarantees for future
runs. Database isolation and prerequisites must be verified in each environment.
No full backend suite, production-scale benchmark or provider/worker validation
was performed.
