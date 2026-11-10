# Database and background services

This is provider-independent configuration for the existing application, not a
provisioning script. Commands below are for a later controlled deployment. Do not
run them against an existing database without reviewing the target and backup.
Use the same reviewed backend image/release for the API, worker and scheduler.

## PostgreSQL/PostGIS

`config/settings.py` continues to read individual `DB_*` variables. It does not
parse `DATABASE_URL`; map any provider-issued connection values to these names.

| Variable | Requirement |
| --- | --- |
| `DB_ENGINE` | Defaults to `django.contrib.gis.db.backends.postgis`; production rejects any other engine. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` | Supply the actual database and login details; no hosted values are inferred. |
| `DB_PORT` | Defaults to 5432; use the provider's connection port if different. |
| `DB_SSLMODE` | Optional libpq mode; blank preserves libpq's existing behavior. |
| `DB_SSLROOTCERT` | Optional readable CA certificate path, mounted into each process/container that connects. |

Choose the transport after selecting the host. For remote TLS, prefer
`DB_SSLMODE=verify-full` and the provider's CA certificate at `DB_SSLROOTCERT`.
This validates the certificate and hostname. `require` encrypts but does not
guarantee hostname verification; blank/default libpq behavior is not a guarantee
of verified TLS. If private networking is used, verify its isolation and provider
requirements rather than assuming a public connection is safe. Do not switch off
certificate verification to suppress an error. Local HTTP/development database
configuration and unspecified TLS options remain unchanged.

No pooling or persistent-connection changes are introduced. The existing ASGI
configuration keeps Django's default connection lifetime.

The database image/server must actually include PostGIS, not just plain
PostgreSQL. Required extensions are:

- `postgis`: geographic fields in business, merchant-application and transit
  migrations; spatial queries also use coordinate transforms and `ST_SquareGrid`.
- `pg_trgm`: `merchant_application/0019_enable_duplicate_name_trigrams.py` creates
  this through Django's `TrigramExtension` for duplicate-name comparisons.

Have the database administrator enable these in the application database before
release, or verify that the migration role may create them. GeoDjango may attempt
PostGIS extension creation, but that cannot install missing server packages or
grant permissions. Example SQL for the later initialization operation:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Review pending migrations and take a backup before upgrades. Run migrations once
as a release operation, never in API/worker/Beat startup:

```sh
python manage.py migrate
```

Migrations create tables and their defined configuration data, not a complete
working demonstration dataset. The service-area polygon needs the existing
`python manage.py load_cebu_boundary` command on a fresh database. Provision the
first administrator with `createsuperuser` and review taxonomy/transit data needs.
Existing development seed commands may intentionally refuse hosted databases;
do not bypass their safety checks. Use persistent database storage and a tested
backup/restore method. A code rollback does not reverse a schema migration.

## Redis

Existing consumers are Celery's broker (`CELERY_BROKER_URL`) and Channels
notification signals (`NOTIFICATION_REDIS_URL`). No additional direct Redis
consumer or Celery result backend was found. Both URLs are already configurable;
their implementation is unchanged.

One Redis instance is sufficient initially. Existing local examples use database
0 for Celery and 1 for Channels. If a provider allows only database 0, both can
use it: Channels already uses the `sugbogo_notifications` prefix, distinct from
the current Celery keys. Logical databases/prefixes are not security boundaries.
Never use `FLUSHDB` to clear only one consumer's data in a shared database.

Set both hosted URLs explicitly. Use private networking and authenticated access;
do not publish Redis unauthenticated. For TLS use `rediss://`, with certificate
and hostname verification. The installed clients accept this broker example:

```text
rediss://redis.example.com:6380/0?ssl_cert_reqs=required&ssl_check_hostname=true
```

Use the equivalent `/1` URL for Channels when supported. Add provider credentials
through runtime secrets and URL-encode reserved characters. For a private CA,
mount the certificate and add the appropriate URL-encoded `ssl_ca_certs` query
parameter. Do not use `ssl_cert_reqs=none`. CA trust, authentication and actual
reachability must be verified with the selected host.

Broker messages must survive the intended restart/redeploy window: configure
Redis persistence and persistent storage with the provider, and review eviction
and memory limits (prefer no eviction of queued work). Application recovery paths
help but do not make every lost broker message recoverable. Channels signals are
transient; notification records remain authoritative in PostgreSQL and clients
resynchronize through REST. No result backend is needed: results remain ignored.

## Worker and Beat

All commands run from `/app` in the existing Linux image and use `-A config`.
Use one independent process/container per role. No startup command runs migrations.

The worker must consume `celery` and `gemini_sentiment_shadow`. Although shadow
inference is optional, the existing Beat schedule always publishes its recovery
task to that queue. Consuming both avoids accumulating unconsumed recovery hints.
The service returns immediately while `GEMINI_SENTIMENT_SHADOW_ENABLED` and
`GEMINI_SENTIMENT_CUTOVER_ENABLED` are false. Queue subscription does not enable
either feature; leave those flags disabled unless separately approved.

`CELERY_WORKER_CONCURRENCY` is optional outside Docker; when absent, bare local
workers retain Celery's default. The Docker image defaults it to **1**, and it can
be overridden with a positive integer at runtime. Increase it only after measuring
CPU and model memory. Keep Linux's default prefork pool; the existing Windows
`--pool=solo` instructions remain local development instructions.

Run **exactly one Beat instance** for this environment, including during updates.
Do not use `worker --beat` or independently start Beat in every API replica.
The built-in persistent scheduler and all task schedules/retries remain unchanged.
Timezone remains UTC: daily discovery at 02:00 UTC (10:00 Manila), review summaries
at 03:00 UTC (11:00 Manila), and login-history pruning at 04:00 UTC (12:00 Manila).

`CELERY_BEAT_SCHEDULE_FILENAME` defaults to `celerybeat-schedule` for bare local
use. The Docker image sets `/var/lib/sugbogo/celerybeat-schedule` and creates its
parent directory writable by its existing `sugbogo` user. Mount persistent storage
at `/var/lib/sugbogo` and verify ownership after mounting. Obtain the image's UID
and GID with `docker run --rm sugbogo-api:local id`; a host bind mount may replace
the image directory's ownership. Persist the entire directory, including any
scheduler-created companion files. Do not share it between simultaneous Beats.

Without a volume the path is writable, but state is lost when the container is
replaced, potentially repeating or changing timing of scheduled work. Keep the
state through releases. The foreground container commands below disable Beat's
PID file; enforce the singleton through hosting process/replica controls.

## Docker startup commands

From `sugbogo_backend`, build the same image as documented in `linux-build.md`.
Inject a protected environment file outside the build context or use the host's
runtime secret configuration. Replace all placeholder paths; do not bake secrets
or CA credentials into the image.

API:

```sh
docker run --rm --env-file /secure/path/backend.env \
    --env PORT=8000 --publish 127.0.0.1:8000:8000 \
    sugbogo-api:local
```

Worker (image default concurrency is 1; this explicit value is configurable):

```sh
docker run --rm --env-file /secure/path/backend.env \
    --env CELERY_WORKER_CONCURRENCY=1 \
    sugbogo-api:local python -m celery -A config worker \
    --loglevel=INFO --queues=celery,gemini_sentiment_shadow
```

Beat (one instance, with persistent writable state):

```sh
docker run --rm --env-file /secure/path/backend.env \
    --mount type=bind,src=/persistent/sugbogo-beat,dst=/var/lib/sugbogo \
    sugbogo-api:local python -m celery -A config beat --loglevel=INFO --pidfile=
```

Bare Linux uses the same `python -m celery ...` commands after providing the
environment, conservative concurrency and a writable schedule filename. Stop
services gracefully during updates; avoid overlapping Beats or mixing task-code
versions that cannot understand each other's queued messages. Initialize SQL and
required data before starting workers/scheduled jobs. Sentiment model artifacts
and their paths are still a separate provisioning task.

## MongoDB

No client/analytics rewrite is needed. `MongoDBService` already lazily accepts
`MONGODB_URI` and selects `MONGODB_DATABASE`, with bounded connection/server
selection timeouts. Use a provider-issued authenticated `mongodb://` or
`mongodb+srv://` URI, verified TLS, appropriate network access rules and persistent
storage/backups. Do not disable TLS verification. An empty URI is not a disabled
mode: PyMongo may attempt its default localhost server. Configure both variables
for deployed visibility and route-intent analytics.

Visibility writes lazily create the unique deduplication index and the reporting
index through `VisibilityEventService.ensure_indexes`. The deployment identity
therefore needs index-creation as well as read/write permissions, or an
administrator must create the matching indexes before use. SQL migrations do not
initialize MongoDB. The existing optional controlled setup command is:

```sh
python manage.py initialize_route_planning_tracking
```

That creates/verifies route-intent indexes and the `tracking-state-v1` history
boundary without generating events. Re-running preserves its original start
time. `verify_visibility_mongodb` is read-only diagnostics, not an initializer.
Do not reset tracking metadata to imply history that was never collected.

Existing outage behavior is preserved: visibility writes can return controlled
503 responses and enter a failure cooldown; route-intent ingestion can return
503, while reporting paths can return unavailable-source metadata. Missing
collections/initialization can also be reported separately. This is degraded
analytics, not a blanket application startup check or an automatic fallback
database. Verify real hosted connectivity and permissions before using the data
as evidence in the defense.

## Provider checklist and references

Validation on 2026-11-10: all 30 focused configuration, startup, Celery and MongoDB
tests passed on Windows and in the cached Linux image rebuild. Production
PostGIS selection, optional TLS parsing, both Redis URL parsers, all scheduled
task registration, shadow-queue guards and mocked MongoDB outages were checked.
The actual Linux worker CLI started with prefork concurrency 1 and both queues;
Beat started with its writable image state path. Both shut down cleanly, and
Beat state reopened afterward. These checks used an in-memory broker, disposable
files and disabled external networking. No business tasks, database migrations
or live provider calls were executed. Hosted TLS, index privileges, broker
persistence and real end-to-end delivery remain unverified.

Still required later: provision persistent PostGIS, Redis and MongoDB; select TLS
and mount trusted CAs; supply runtime variables to all roles; apply reviewed SQL
migrations and required data; initialize/verify MongoDB indexes; mount writable
Beat state; enforce one scheduler; verify backups, queue restart behavior and real
end-to-end delivery. No cloud infrastructure or live credentials were used here.

- [Django PostgreSQL options](https://docs.djangoproject.com/en/6.0/ref/databases/)
- [libpq TLS verification](https://www.postgresql.org/docs/current/libpq-ssl.html)
- [Celery 5.6 periodic tasks and scheduler persistence](https://docs.celeryq.dev/en/v5.6.0/userguide/periodic-tasks.html)
