# Admin review report resolution

Branch: `feat/admin-review-report-resolution`
Starting commit: `673c5fe` (review moderation consistency)

## Implemented API

New routes under `/api/admin/review-reports/`, leaving merchant-dispute routes unchanged:

- GET `/`: paginated reports, with status/type/business/review filters and stable newest-first ordering.
- GET `/<report_id>/`: report details, review text/status/photos, business, author, reporter, and related report counts.
- POST `/<report_id>/approve/`: administrator decision with required `admin_notes`.
- POST `/<report_id>/reject/`: administrator decision with required `admin_notes`.

All endpoints require ADMIN or SUPER_ADMIN. Use the existing response envelope, StandardPagination, explicit input validation, and optimized querysets. Do not return device identifiers or unrelated personal data.

## User-approved policy

- Approval rejects the review, applies the existing penalty once per review, and rewards once per approved report excluding self-reports. Related reports remain independently pending.
- Rejection preserves review status and spam flag until explicit review-level clearance, to avoid releasing independently held content. A report rejection alone never releases an AI-held review.

## Implementation boundaries

Use feature-specific service, serializer, view, and test modules within admin moderation. Lock affected review/report records in consistent order with report creation. Only pending reports may resolve; repeated requests must have no duplicate reputation or audit effects. Record actor and previous/new states using AdminActivity, with migration for report decision action choices. Use existing report notes and audit timestamps instead of adding report model fields unnecessarily.

Reuse ReviewModerationConsistencyService when a decision excludes review evidence. Keep decision, reputation, audit, and synchronous aggregate updates atomic; regenerate after commit. Required notes follow existing dispute-resolution validation.

AI image classification and whole-review hold inspection are owned by Ralph and remain outside this branch. No frontend integration, automatic resolution of related reports, report withdrawal endpoint, or global moderation-policy changes are included.

## Verification

- Queue/detail filtering, pagination, validation, missing IDs, and minimal response fields.
- Authentication and role restrictions for reads and writes.
- Approved/rejected state transitions according to approved policy.
- Author penalty/report reward idempotency, including self-report safeguards.
- Immediate insight consistency and task dispatch only after commit.
- Required-note validation and audit actor/reason/state details.
- Rollback if reputation/audit/consistency updates fail.
- Concurrent decisions on the same report and on different reports for the same review.
- Existing dispute and report-submission regressions.

## Validation results - 2026-10-03

The starting focused baseline passed 121 tests. The completed focused run passed 151 tests covering report resolution, existing dispute/report workflows, and reputation services. PostgreSQL concurrency tests cover conflicting decisions on one report and simultaneous approvals of sibling reports, preserving a single author penalty.

```powershell
# Run from sugbogo_backend using a configured backend Python environment.
python manage.py test apps.admin_operations.moderation.services.tests apps.reviews.services.tests.test_review_report_service apps.review_disputes.services.tests.test_review_dispute_service apps.review_disputes.views.tests.test_review_dispute_views apps.admin_operations.moderation.views.tests.test_manage_review_report_views apps.users.services.tests.test_reputation_service --noinput
python manage.py makemigrations --check --dry-run
```

The local test run used the separate ignored environment described in `review-moderation-consistency-validation.md`, with a fast password hasher for fixture creation only. Migration drift check passed. The generated `activity_management/0003_alter_adminactivity_aact_action.py` migration was applied to the disposable test database, not the development database.

API resolution bodies use `{"admin_notes": "At least twenty characters explaining the decision."}`. Invalid/blank notes return 400. Invalid queue filters return 400, missing reports return 404, and already-resolved decisions return 400 without duplicate side effects. Anonymous access returns 401; non-admin access returns 403. Results follow the existing success/error envelopes.

The previous expanded-suite baseline contained seven failures outside the focused passing suite; this branch does not claim those are fixed. Live Celery/provider execution, frontend integration, full AI hold inspection, and a vulnerability assessment were not performed. Explicit review clearance is a follow-up workflow; rejecting a report never automatically clears an existing flag.
