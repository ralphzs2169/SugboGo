# Notification inbox implementation and validation

Branch: `feat/notification-inbox`
Status: schema/API approved, implemented, tested, and approved for commit/push.

## Scope

Add `apps.notifications` as a shared backend app for Explorer, Merchant, Admin, and Super Admin inboxes. Use existing JWT authentication, uppercase database fields, service/view separation, response helpers, and StandardPagination. This branch builds storage and recipient-facing REST APIs. Actual business-event producers, frontend wiring, WebSockets, and push delivery follow in separate branches.

## Approved storage

One notification belongs to one recipient. Table: `NOTIFICATION`.

| Field | Purpose |
| --- | --- |
| NOTF_ID | Primary key |
| USER_ID | Recipient foreign key; cascade when that user is deleted |
| NOTF_TYPE | Backend-controlled event code, up to 64 characters |
| NOTF_TITLE | Plain-text title, up to 160 characters |
| NOTF_BODY | Plain-text message, up to 2000 characters |
| NOTF_TARGET_TYPE | Optional backend-controlled resource type, up to 64 characters |
| NOTF_TARGET_ID | Optional positive resource ID; both target fields must be provided together |
| NOTF_DEDUP_KEY | Required internal event key, up to 160 characters |
| NOTF_READ_AT | Nullable timestamp; null means unread |
| NOTF_CREATED_AT / NOTF_UPDATED_AT | Creation/update timestamps |

Database uniqueness on recipient plus event key prevents duplicate creation. Index recipient/time and recipient/read state for inbox and badge queries. Repeated creation with the same key returns the original notification without overwriting content or read state. Creation is an internal service operation; clients cannot create notifications or select a recipient.

Targets are navigation hints, not access grants: destination APIs must independently authorize access. No arbitrary URLs or private report evidence in notification responses. Event integration will define permitted event/target codes and recipient policies before attaching producers.

## Approved API

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/notifications/` | Own inbox, newest first with ID tie-breaker; pagination; optional `is_read=true/false` filter |
| GET | `/api/notifications/unread-count/` | Own unread count |
| POST | `/api/notifications/<id>/read/` | Mark own item read; repeated calls preserve its first read timestamp |
| POST | `/api/notifications/read-all/` | Mark currently unread own items read; return updated count |

All routes require an authenticated active account. An item belonging to another recipient behaves like a missing item (404). Responses omit recipient IDs and deduplication keys. No client creation, deletion, or mark-unread API in this branch. No automatic retention deletion is introduced.

## Tests and migration safety

Cover signed JWT authentication, disabled accounts, role coverage, cross-user isolation, filters/pagination/order, unread counts, idempotent read operations, duplicate creation, rollback, concurrent duplicate creation, and migration consistency. Use the existing disposable PostgreSQL/PostGIS test setup. Generate and inspect a new app migration; do not apply it to the development database without approval. Preserve unrelated files and existing review behavior.

## Merge dependency

The branch currently starts from `828e629`, the contract-alignment branch. Merge preceding review branches in order or reconcile the base before opening the notification PR. Shared integration edits should be limited to app registration and root URL inclusion.

## Recorded validation (2026-10-04)

- 21 notification tests passed, including concurrent duplicate event creation, transactional rollback, recipient isolation, signed JWT authentication, disabled accounts, all application roles, and idempotent read operations.
- Combined notification/review/dispute/moderation/activity run: 448 tests, 447 passed, one existing failure. The remaining failure is the previously documented merchant own-business review-like policy mismatch; this branch preserves that behavior and its failing test.
- Django system checks passed; `makemigrations --check --dry-run` reported no changes.
- The initial migration was generated and inspected, then applied only to disposable test databases. No development-database migration was executed.
- Tests used the existing ignored local runner with accelerated fixture password hashing. No external notification delivery or frontend integration was measured.

Reproduce from `sugbogo_backend` in a working backend environment:

```powershell
python manage.py test apps.notifications --noinput
python manage.py test apps.notifications apps.reviews apps.review_disputes apps.admin_operations.moderation apps.admin_operations.activity_management --noinput
python manage.py makemigrations --check --dry-run
```

List responses use the existing paginated envelope; individual read responses return the item. Unread-count data is `{"unread_count": N}` and bulk-read data is `{"updated_count": N}`. Notification items expose `id`, `type`, `title`, `body`, `target_type`, `target_id`, `is_read`, `read_at`, and `created_at`. An omitted `is_read` filter returns both read and unread items.

Internal producers must call NotificationService.create within the business operation's transaction when creation needs to roll back with that operation. Stable event keys deduplicate retries. No event producer is attached yet, so real inboxes will remain empty until event integration is implemented. Resource targets do not authorize access, and clients must render title/body as plain text.
