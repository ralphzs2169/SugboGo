# Experimental business rating deployment and acceptance

This is current operational guidance. The Phase 6 and Phase 6B verification
reports are historical evidence and must not be rewritten as deployment status.
Do not run migrations, repairs, or fixture creation against an environment without
the operator's authorization. The commands below are instructions, not a record
that they were executed during the final mobile cleanup.

## Deployment sequence

1. Inspect the target environment and apply the reviews rating migrations 0029
   and 0030 using the release's migration runner. These contain no automatic
   historical sentiment backfill. From the configured Windows development backend:

   ```powershell
   .\.venv\Scripts\python.exe manage.py showmigrations reviews
   .\.venv\Scripts\python.exe manage.py migrate --plan
   .\.venv\Scripts\python.exe manage.py migrate reviews
   ```

   Review the migration plan before applying it. Deployment systems should use
   their established release/migration commands instead of a development venv.
2. Deploy the matching backend/web release. Do not start processes using the new
   rating columns against an unmigrated database.
3. Warm-restart Celery workers using the environment's process supervisor after
   checking active/reserved work. Editing Python files does not reload a worker.
   Established Windows development startup (one worker; use the existing process
   ownership/supervisor rather than launching a duplicate):

   ```powershell
   .\.venv\Scripts\celery.exe -A config worker -P solo -l info
   ```

4. Inspect the actual running workers, not only a locally imported Celery app:

   ```powershell
   .\.venv\Scripts\celery.exe -A config inspect ping
   .\.venv\Scripts\celery.exe -A config inspect registered
   .\.venv\Scripts\celery.exe -A config inspect active_queues
   ```

   Every intended rating worker must register:

   ```text
   apps.reviews.tasks.recalculate_business_rating
   apps.reviews.tasks.recover_business_ratings
   apps.reviews.tasks.reconcile_business_ratings
   ```

5. Verify the expected queue in `active_queues`. Repository defaults use queue,
   direct exchange, and routing key `celery`, with no custom task routes. Confirm
   any environment overrides match worker subscriptions and broker configuration.
6. Restart and verify exactly one Beat scheduler using its existing schedule
   location. The verified development startup used:

   ```powershell
   .\.venv\Scripts\celery.exe -A config beat -l info --schedule .venv\celerybeat-r7c-py312
   ```

   Preserve the target environment's actual schedule path. Do not launch a second
   scheduler to test a live scheduler.
7. Observe Beat dispatch and matching worker receipt/completion logs for both
   `recover-business-ratings` (60 seconds) and `reconcile-business-ratings`
   (300 seconds). Registration or presence in a settings dictionary is not proof
   of delivery. Confirm pending aggregate revisions eventually complete, or that
   failures persist recoverable demand/backoff. Empty task batches are valid.
8. Confirm `BUSINESS_RATING_DEFAULT_SCORING_VERSION` and the selected versions on
   existing aggregates. The default is `legacy-unverified-v1`; existing aggregates
   retain their selected version. A new default does not migrate old aggregates.
   Do not mix versions or automatically rescore missing historical sentiment.
9. Set `EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True` only for the intended
   environment and restart affected backend processes. Automatic updates are
   independently controlled by `BUSINESS_RATING_AUTO_UPDATES_ENABLED` (default
   `True`). Inspect effective settings and authenticated Explorer responses;
   the DTO's flag is not a worker health check.
10. Verify mobile against that backend: rated discovery cards show `★ 3.6 (7)`;
    the profile hero shows a value-only rating beside the name; the collapsed
    header remains intentional; Reviews combines `★ 3.6 | Reviews (total)` in
    its title. Check unrated published counts, no hidden rating announcements,
    no duplicate profile block, and the recent-insight explanatory state only
    on the Reviews collection. Use approved isolated fixtures for live review
    publication/edit/deletion checks. Device layouts and TalkBack require actual
    acceptance; component tests do not establish physical rendering.

## Stale-process lesson and remaining boundaries

The October 30 Phase 6B investigation found an old worker without rating tasks
and an old Beat schedule without rating entries. Fresh application discovery was
correct. Restarting the actual development worker and Beat resolved the issue;
no task-discovery implementation change was needed. Restart and inspect both
processes on deployment, then observe actual delivery.

Missing historical sentiment is separate from aggregate recovery. Do not treat
unclassified reviews as neutral, automatically backfill them, or claim that a
fresh aggregate includes every published review. See the lifecycle guide for
operator-invoked repair boundaries. The five-contributor minimum and signed
average formula are unchanged. Multilingual sentiment-model quality and public
production readiness require separate validation.
