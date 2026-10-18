# Notification event integration implementation and validation

Branch: `feat/notification-event-integration`
Base: `223c69f` (notification inbox; merge preceding branches first).
Status: recipient and atomic transaction policy approved on 2026-10-05; merchant admission decisions added to the approved scope on 2026-10-16.

## Approved events

| Event | Recipient | Navigation |
| --- | --- | --- |
| Review report approved/rejected | Report submitter; generic outcome message | None: there is no reporter-facing report-detail GET endpoint |
| Review becomes rejected through an approved report or upheld dispute | Review author; one rejection notice per review | None: rejected review detail is not a recipient-facing GET route |
| Merchant dispute upheld/dismissed | Merchant who submitted the dispute | Own review-dispute resource |
| Business name change approved/rejected | Merchant who submitted the request | Own name-change request resource |
| Business classification change approved/rejected | Merchant who submitted the request | Own classification-change request resource |
| Business location change approved/rejected | Merchant who submitted the request | Own location-change request resource |
| Merchant application approved | Applicant | None: approval is shown through the existing application status and Merchant portal flows |
| Merchant application rejected | Applicant | None: rejection feedback remains in the authorized application status flow |

Use generic messages: do not copy administrator notes, reporter/merchant identities, report evidence, or private review text into notification content. Rejection reasons remain available through authorized request-detail APIs. A self-reporter may receive both the distinct report outcome and author-rejection notice; these describe different events. A dismissed dispute or rejected report must not imply the review was cleared or republished.

No admin broadcast, application submission/withdrawal alerts, feedback-edit alerts, likes/replies, or AI-hold notices are included. Merchant application notices are emitted only for confirmed approval and rejection decisions. Notification targets are backend resource hints; no application target is emitted because the mobile navigation contract does not define one.

## Consistency and duplicates

Create persistent inbox records inside the existing atomic decision transaction. If notification creation fails, the decision transaction rolls back rather than committing an outcome without its inbox record. External delivery remains outside this transaction and outside this branch.

Use a stable event key per resolved report, dispute, merchant change request, or merchant application submission. Application decision keys use the persisted submission ID, so a retried decision is idempotent while a later corrected submission can receive its own decision notification. Author-rejection notices share one per-review key across report and dispute paths. Emit the author notice only when transitioning from a non-rejected state to rejected; repeated/sibling decisions do not produce another author rejection alert. Existing business creation, account promotion, feedback, penalties, decision rules, audit records, and insight refreshes remain unchanged.

## Verification

Test approved/rejected outcomes and exact recipients, messages without private content, independent sibling report outcomes, single author rejection across both moderation paths, self-report behavior, duplicate safety, unauthorized decisions producing no notification, and notification/audit failures rolling back the entire decision. For merchant applications, cover persisted submission-scoped deduplication, separate resubmission decisions, commit-only publication, rollback, business creation, role promotion, rejection feedback, and existing service/API permissions. Rerun inbox and impacted decision tests using disposable databases.

Integration touches existing review moderation, three merchant request services, and the merchant application decision service, plus notification event helpers/tests. No new endpoint or schema is proposed.

## Recorded validation (2026-10-05)

- Final combined run: 163 tests passed across notifications, admin moderation, and name/classification/location request workflows.
- Added 18 event integration tests and strengthened existing concurrent report tests to check notification counts.
- Verified exact recipients and outcomes, no private notes/evidence in messages, self-report notices, independent sibling outcomes, one author rejection notice across report/dispute resolution in either order, denied API decisions, and rollback when notification storage fails.
- A failure on the second report notification rolls back the first notification, review/report states, reputation and audit effects; the queued insight-refresh callback is discarded.
- Merchant approval and rejection rollback tests preserve pending requests and original business data. Location rollback also verifies the prior live location and landmarks.
- Django system checks passed; migration consistency reported no changes. No development-database migration was performed.
- Tests used the existing ignored runner with accelerated fixture hashing and disposable PostgreSQL/PostGIS databases. No WebSocket, push, or frontend delivery was tested.
- The previously documented merchant own-business like policy mismatch remains outside this targeted run and unchanged.

Reproduce from `sugbogo_backend` with a configured backend environment:

```powershell
python manage.py test apps.notifications apps.admin_operations.moderation apps.merchant_operations.business_profile.views.tests.test_business_name_change_views apps.merchant_operations.business_profile.views.tests.test_business_classification_change_views apps.merchant_operations.business_profile.views.tests.test_business_location_change_views --noinput
python manage.py makemigrations --check --dry-run
```

Backend target codes are `review_dispute`, `business_name_change`, `business_classification_change`, and `business_location_change`. The frontend must map these hints to its own authorized detail screens; report outcome and author rejection notices intentionally have no target. This branch does not add alerts for past decisions.

## Merchant admission policy extension (2026-10-16)

The approved event scope now includes confirmed merchant application approval and rejection decisions. These notifications belong to the applicant account, use the persisted submission as their event identity, and contain no target metadata. Editing review feedback alone is not a decision event, and the integration does not backfill historical decisions.

### Validation

- All 6 focused merchant application notification integration tests passed.
- The affected notification, admin decision/API, and merchant application suites ran 123 tests. Of these, 122 passed in the combined run; the remaining existing document-detail test required a Cloudinary signing secret and passed when rerun with dummy local signing values.
- Django system checks passed, and the migration drift check reported no changes.
