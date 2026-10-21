# Merchant application lifecycle guards

This branch closes two gaps: unchanged saves satisfying rejection feedback, and
approval promoting an applicant whose account has become ineligible.

## Corrections after rejection

Rejection stores SHA-256 fingerprints for all five application sections on the
review (`MAREV_SECTION_FINGERPRINTS`). Resubmission requires every section named
in the latest rejection feedback to differ from that review's saved content.
The existing response fields (`feedback[].is_changed` and admin
`changed_sections`) use the same comparison. API routes and response shapes stay
the same; mobile and web use their existing feedback interfaces.

Fingerprints exclude record IDs, save timestamps, attachment filenames, and
collection ordering. Leading/trailing text whitespace and null/empty optional
values are equivalent. Coordinates are rounded to seven decimal places. Closed
days and 24-hour days ignore irrelevant opening/closing times. Reordering tags,
recreating identical landmarks/hours, empty attachment saves, and changing a
value then restoring the rejected value do not satisfy feedback.

Photo changes compare category, stored asset ID, and URL; document changes
compare document type, asset ID, and version. Replacing an attachment with a new
asset counts as a correction. This does not verify that the attachment's bytes
are different or that the reviewer concern has been resolved: admins still
review the resubmission. File-content validation and duplicate detection belong
to the later upload-validation and duplicate-review branches.

## Approval and account state

Both approval endpoints re-read and lock the applicant before locking the
application, in the same order as identity saves. Approval requires an active,
email-verified Explorer or Merchant account without an existing owned business.
Pending, suspended, disabled, unverified, and administrative accounts cannot be
approved. Validation failure creates no business, location, approval review, or
approval notification and leaves the application submitted.

Manual reactivation can restore eligibility for the same pending application;
approval does not reactivate an account or restore sessions. If approval commits
first, a subsequent account deactivation remains valid and retains the approved
business, following the existing IAM retention policy. Rejection uses the same
user-then-application lock order; identity, location, and hours saves lock and
re-read application state so stale instances cannot edit submitted content.

## Migration and rollout

From the repository root in PowerShell:

```powershell
Set-Location sugbogo_backend
..\.venv\Scripts\python.exe manage.py migrate
```

Apply migrations **before serving this backend version**:

- `0016_merchantapplicationreview_section_fingerprints` adds the review field.
- `0017_baseline_existing_rejections` uses historical models to establish a
  baseline for the latest rejection of each currently rejected application.

Pause merchant writes during the migration and backend restart. The original
content of older rejected submissions was not retained, so it cannot be
reconstructed. For those applications, the content at rollout becomes the
baseline, and feedback sections require a further correction even if they were
edited before rollout. Existing drafts, submitted/approved applications, review
history, feedback text, submission counts, and earlier rejection reviews are
preserved. Nonempty fingerprints are not overwritten by a repeated backfill.

Reversing the data migration is a no-op; reversing the schema migration removes
the fingerprints. Rolling back code and schema must be coordinated.

## Verification

Run the merchant modules explicitly: this repository's merchant `tests/`
directory lacks `__init__.py`, so a package-only test label skips its tests.

Focused command from `sugbogo_backend`:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.merchant_application.tests.test_lifecycle_guards apps.merchant_application.tests.test_lifecycle_concurrency apps.merchant_application.tests.test_application_service apps.merchant_application.tests.test_application_lifecycle apps.merchant_application.tests.test_admission_discovery apps.admin_operations.business_management.tests.test_manage_application_service apps.admin_operations.business_management.tests.test_manage_application_views apps.notifications.services.tests.test_merchant_application_notifications --keepdb --noinput
```

Coverage includes unchanged saves, reverted corrections, all feedback sections,
landmark edits, attachment replacements, repeated rejection, merchant/admin
feedback consistency, both approval routes, account eligibility, stale saves,
historical-model backfill, notification/submission history, immediate discovery
publication, and real PostgreSQL approval/deactivation concurrency.
