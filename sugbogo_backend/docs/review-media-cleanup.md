# Durable review-deletion media cleanup

`ReviewService.delete_review()` keeps its review-first lock, ownership checks,
author-removal audit, hard deletion, counters and insights. Before cascade it
registers one `ReviewMediaCleanup` row per distinct `(review ID, public ID,
resource type)`. The rows have no foreign key to deleted content. Registration
failure rolls back deletion; rollback discards both the rows and dispatch callback.
Cloudinary is never called from the deletion transaction.

Review/reply photos and dispute evidence images use `resource_type="image"`.
Dispute documents use `resource_type="raw"`, matching their existing uploads.
Both use the existing uploads' delivery type `upload`. No URLs, credentials,
review text, report explanations or evidence file contents are retained.
Legacy media without a stored public ID cannot be destroyed reliably; no URL-based
identifier guessing is introduced.

## Delivery and recovery

After commit, best-effort Celery dispatch sends only cleanup row IDs. A callback,
broker or process failure cannot erase the PostgreSQL manifest. Celery Beat runs
`apps.reviews.tasks.recover_review_media_cleanup` every five minutes, redispatching
up to 100 due pending records. Worker/Beat availability is required for progress;
PostgreSQL preserves work while they are unavailable.

Each worker locks only its cleanup row using `select_for_update(skip_locked=True)`
for a provider call with a 15-second SDK timeout. Competing workers skip that row.
No review, business, case or audit row is locked by the worker. A crash releases
the database lock and rolls back uncommitted progress; the pending row remains.
Calls that completed externally before a crash can be repeated safely: `ok`,
`not found`, and the provider's NotFound exception are treated as success.

Failures persist a sanitized exception class, attempt count and next-attempt time.
No provider exception text or asset identifiers are logged by the cleanup service.
Retries use 60, 120 and 240 second backoff (maximum delay 300 seconds), with four
persisted failed attempts per cycle. Celery retry accelerates recovery, while the
database due time and periodic redispatch remain authoritative if retry dispatch
fails. Authorization, invalid-request and invalid-argument failures require
intervention immediately. Other failures stop at the same attempt limit.

`pending` means eligible for recovery at its next-attempt time, `succeeded` records
confirmed absence, and `failed` means intervention is required. These are cleanup
statuses, not review or moderation statuses. Inspect the table through existing
operator database/Django shell access; no public or moderation-management API is
added. To restart selected failed records after addressing the cause:

```text
python manage.py retry_review_media_cleanup 123 456
```

The command resets only explicit failed IDs for a new bounded cycle, atomically,
and requests dispatch after commit. A failed dispatch still leaves recoverable work.
Do not purge pending/failed rows. Retention of completed operational records remains
a product/operations policy dependency; no automatic purge is introduced.

## Scope and dependencies

Apply migration `reviews.0020_review_media_cleanup` and deploy workers and Beat
with the new tasks/schedule. Redis remains delivery infrastructure rather than the
source of cleanup truth. This change does not repair already-orphaned assets whose
identifiers were previously lost, or promise instantaneous invalidation of CDN copies.

The existing dispute-evidence upload finalization race remains separate: an upload
not yet committed when deletion captures assets cannot be included in its manifest.
Individual photo/reply/evidence deletion and unrelated Cloudinary consumers retain
their existing behavior. Task 3B.4 adds transactional closure notices independently
of this cleanup worker; see `review-deletion-notifications.md`.
