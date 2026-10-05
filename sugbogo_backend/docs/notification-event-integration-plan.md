# Notification event integration implementation and validation

Branch: `feat/notification-event-integration`
Base: `223c69f` (notification inbox; merge preceding branches first).
Status: recipient and atomic transaction policy approved on 2026-10-05; implemented locally and awaiting staging/commit approval.

## Approved events

| Event | Recipient | Navigation |
| --- | --- | --- |
| Review report approved/rejected | Report submitter; generic outcome message | None: there is no reporter-facing report-detail GET endpoint |
| Review becomes rejected through an approved report or upheld dispute | Review author; one rejection notice per review | None: rejected review detail is not a recipient-facing GET route |
| Merchant dispute upheld/dismissed | Merchant who submitted the dispute | Own review-dispute resource |
| Business name change approved/rejected | Merchant who submitted the request | Own name-change request resource |
| Business classification change approved/rejected | Merchant who submitted the request | Own classification-change request resource |
| Business location change approved/rejected | Merchant who submitted the request | Own location-change request resource |

Use generic messages: do not copy administrator notes, reporter/merchant identities, report evidence, or private review text into notification content. Rejection reasons remain available through authorized request-detail APIs. A self-reporter may receive both the distinct report outcome and author-rejection notice; these describe different events. A dismissed dispute or rejected report must not imply the review was cleared or republished.

No admin broadcast, submission/withdrawal alerts, likes/replies, admission decisions, or AI-hold notices in this first integration branch. Those need their own recipient/event policies. Notification targets are backend resource hints; frontend routing is a later integration responsibility.

## Consistency and duplicates

Create persistent inbox records inside the existing atomic decision transaction. If notification creation fails, the decision transaction rolls back rather than committing an outcome without its inbox record. External delivery remains outside this transaction and outside this branch.

Use a stable event key per resolved report, dispute, or merchant change request. Author-rejection notices share one per-review key across report and dispute paths. Emit the author notice only when transitioning from a non-rejected state to rejected; repeated/sibling decisions do not produce another author rejection alert. Existing penalties, decision rules, audit records, and insight refreshes remain unchanged.

## Verification

Test approved/rejected outcomes and exact recipients, messages without private content, independent sibling report outcomes, single author rejection across both moderation paths, self-report behavior, duplicate safety, unauthorized decisions producing no notification, and notification/audit failures rolling back the entire decision. Cover merchant decisions through their existing service/API tests. Rerun inbox and impacted decision tests using disposable databases.

Integration touches existing review moderation and three merchant request services, plus notification event helpers/tests. No new endpoint or schema is proposed. Ralph may be editing those decision services; coordinate these localized hooks before merging his unpublished work.

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
