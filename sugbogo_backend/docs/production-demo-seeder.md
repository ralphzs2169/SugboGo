# Deployed demo dataset

`seed_production_demo` creates five **fictional, publicly visible** cafes around
Capitol/Escario, Fuente, Colon, V. Rama and Guadalupe. Map coordinates are
approximate demonstration points, not verified venue addresses. Business names,
descriptions, account names and review text identify the content as DEMO.

The command works with `DEBUG=False`. It does not change settings or configuration
and does not invoke the development seeders.

## Run

Use the deployed application's normal environment and take a database backup
before inserting public demo content. From the backend directory, preview:

```sh
python manage.py seed_production_demo --dry-run
```

The default without flags is also a dry run. It reads PostgreSQL configuration,
reserved identities and active service boundaries; it performs no database
writes and makes no calls to MongoDB, AI providers or workers. It prints the
locations, planned review counts and planned vouch counts. It cannot verify live
visibility or the final hidden-gem qualification until insertion.

To insert, replace the example with the exact deployed `DB_NAME`:

```sh
python manage.py seed_production_demo --apply --confirm-database YOUR_DB_NAME
```

The exact database confirmation is required in development and production.
The command needs PostgreSQL/PostGIS, an existing valid discovery configuration,
active boundaries covering all five points, and readable MongoDB visibility
storage. It prints the inserted business IDs. No migrations are required.

### Upgrade businesses already created by the original seed

Preview filling the existing five demo profiles:

```sh
python manage.py seed_production_demo --dry-run --enrich-existing
```

Then apply and optionally request real sentiment analysis for their demo reviews:

```sh
python manage.py seed_production_demo --apply --confirm-database YOUR_DB_NAME --enrich-existing --queue-sentiment
```

`--enrich-existing` fills missing photos, contact information, access directions,
postal code, demo arrival point and absent days in the weekly schedule. It replaces
the original `DEMO - no phone` placeholder and original short description. It
preserves custom descriptions, existing covers/photos, edited operating hours,
status, reviews, vouches and counters. It does not refresh discovery scores or
require MongoDB when all five demo businesses already exist. Repeating enrichment
does not duplicate photos, hours or landmarks. Enrichment is transactional.

Newly inserted businesses always receive these complete profiles; they do not
need `--enrich-existing`.

### Why published reviews alone do not produce stars

The rating is calculated from at least five published, valid, eligible sentiment
results for the current text and active scoring contract. The original seed
created review rows without analysis, so even a business with nine reviews had
zero rating inputs. Simply changing the review counter cannot produce stars.

`--queue-sentiment` requests the existing real Gemini workflow for at most ten
marked demo reviews per business, using demo explorers only. It requires
`GEMINI_SENTIMENT_ALL_BUSINESSES=True`, `GEMINI_SENTIMENT_CUTOVER_ENABLED=True`
and a configured `GEMINI_API_KEY`. It neither fabricates inference results nor
changes these settings. Provider usage applies when workers process the jobs.
Requests persist inside the seed transaction and dispatch only after commit.

Celery workers must consume both `gemini_sentiment_shadow` and the normal default
queue, with the configured broker running. The standard pipeline activates a
business once its complete review cohort is analyzed and calculates its rating.
If processing fails or fewer than five reviews are classified as eligible, the
rating remains unavailable. Synthetic disclaimers can affect eligibility; the
seeder does not override provider classifications. Real reviews added later are
handled by normal review processing, not by the demo queue option.

`EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True` must also be configured on the API
server for the rating field to be exposed. This command reports if that flag is
off. Refresh Explore after workers complete; queueing is not proof of completion.

## Data and safeguards

- Five new merchant owners and a dedicated cohort of non-admin demo explorers
  use reserved `@production-demo.sugbogo.invalid` emails and unusable passwords.
  Existing real accounts are never selected, edited, rewarded or impersonated.
- Each business receives 6–10 published synthetic reviews from a reproducible
  random selection of distinct demo explorers. Reviews remain on business
  profiles but are excluded from the community feed.
- Profiles include a demo description/menu, seven operating days (9 AM–6 PM),
  format-valid fictional phone, reserved demo email, example website, access
  directions, postal code and a clearly fictional arrival point. No permits,
  application evidence or verified-business status are invented.
- Cover and gallery images are externally hosted illustrative stock URLs, not
  photos of the fictional businesses. Gallery categories are storefront, interior
  and products. No uploads or downloads occur during seeding. External photo rows
  deliberately have empty Cloudinary public IDs so normal cleanup does not claim
  or delete assets in the application's Cloudinary account. Loading depends on
  the device's access to the image host; URL structure/persistence are tested,
  but live image retrieval was blocked in the implementation environment.
- Three demo specialty tags receive one vouch from each demo explorer. The cohort
  targets a specialty score of at least 0.90, or the configured minimum plus
  0.02, whichever is higher. With the default reputation baseline of 0.20 this
  creates 12 explorers and 36 vouches per business. The cohort is capped at 100;
  unsupported baselines or thresholds cause a refusal rather than unbounded writes.
- Vouch snapshots use the configured baseline. Business and tag counters match
  the inserted rows. The real scoring service measures specialty and visibility
  scores, and all five businesses must pass the current hidden-gem eligibility
  query before commit. Scores are never forced and thresholds are never changed.
- A hidden gem must also rank in the global top ten to get the app's badge/feed
  slot. Eligibility alone cannot guarantee a slot or permanent qualification:
  real traffic, vouch decay and later configuration changes affect results.
- No notifications, reputation rewards, AI moderation calls, analytics events or
  media uploads are generated. Without `--queue-sentiment`, no worker jobs or
  sentiment calls are requested either. Sentiment and star-rating results are
  never fabricated. MongoDB is read using the existing read-only
  visibility path, so the command does not create MongoDB indexes or write events.
- New PostgreSQL rows are inserted in one transaction, and command runs serialize
  with a transaction-scoped advisory lock. A collision, validation error, visibility
  failure or failed qualification rolls back the entire new dataset.
- A complete existing marked dataset is reused unchanged unless enrichment or
  sentiment queueing is explicitly requested. Reruns never restore removed
  engagement. Partial datasets and reserved-identity conflicts cause a refusal.
  There is no broad repair or reset mode.

Public demo engagement participates in ordinary discovery and analytics. Keep the
labels visible and remove the demo dataset when the demonstration is finished.
There is intentionally no broad deletion/reset flag: cleanup after real users
interact requires reviewing dependent records through normal admin workflows.

## Validation

The 20 service/command tests pass against the Django test database with
`DEBUG=False`, using real PostgreSQL/PostGIS inserts and mocked external
visibility/provider/broker calls. They cover read-only preview, database confirmation, real
eligibility calculations, labeled attribution, counters, repeat runs, conflicts,
partial datasets, bounds, complete profiles, preservation of manual edits,
idempotent enrichment, late failure rollback, scoped sentiment requests, and a
full sentiment-cohort-to-ready-rating flow with mocked provider output.
All 22 single-business scoring regression tests also pass. `manage.py check`
reports no issues.

The broader scoring module has three failing batch tests because its separate
`discovery-score-batch-lock` connection alias is unavailable to Django's PostgreSQL
type-registration signal. The seed calls single-business scoring and does not use
that batch connection. Production execution has not been performed.
