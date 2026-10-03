# Review moderation consistency validation

Date: 2026-10-03 (Asia/Manila)
Branch: `fix/review-moderation-consistency`
Baseline commit: `a36e323`

## Changes

- A newly spam-flagged review immediately leaves stored sentiment aggregates. Generated narrative/themes that cite it are cleared, then regeneration is queued after commit.
- Upholding a merchant dispute performs the same consistency updates after rejecting the review. Dismissal preserves its review state and does not queue a refresh.
- Admin resolution and merchant withdrawal lock the dispute row before checking its state, preventing competing decisions from overwriting a completed decision.
- Admin resolution requires an explicit actor. API views pass the authenticated administrator. The existing AdminActivity ledger records the actor, author, review/business/dispute IDs, reason, notes, prior/new states, and timestamp.
- Migration `activity_management/0002_alter_adminactivity_aact_action.py` adds audit action choices; it does not change review statuses.

Existing report thresholds, public review visibility, reputation rules, and BUSN_REVIEW_COUNT semantics are preserved. AI image detection/holds, report-resolution endpoints, and immediate invalidation on text edits are outside this branch.

## Environment

Windows, PostgreSQL/PostGIS, Django 6.0.6. The original `.venv` launcher references a missing Python installation. A separate ignored `venv/review-moderation` environment uses bundled Python 3.12.14 and a `.pth` reference to the existing `.venv/Lib/site-packages`; no packages were downloaded or original environment files changed. This launcher depends on those existing packages and is not a standalone portable environment.

The initial baseline used the normal password hasher. Subsequent runs used an ignored local runner overriding PASSWORD_HASHERS to MD5 for test fixture speed only; application settings and database configuration were not changed. Celery/provider behavior is mocked where relevant; this is not live-worker/provider validation.

## Results

- Baseline: 380 tests, 7 failures, 0 errors.
- New report-threshold regression run against the original HEAD service: fails because no insight refresh is queued.
- Expanded post-change run: 469 tests, 7 failures, 0 errors. All added tests passed; remaining failures match the baseline.
- Focused service/dispute run before adding the withdrawal concurrency case: 120 tests passed.
- Final focused run including both competing-decision cases: 121 tests passed.
- A fast-run resubmission fixture initially failed when two creation timestamps were equal. Its test now declares explicit chronology; production attempt numbering remains unchanged. Handling equal timestamps in real resubmissions remains a follow-up concern.
- Migration drift check: no changes detected. Test database applies the new migration; the development database was not migrated.

New coverage includes immediate aggregate/evidence updates, refresh only after commit, audit actor/state details, dismissal without refresh, rollback on audit failure, and competing decisions using separate PostgreSQL connections. The final focused run also includes admin uphold versus merchant withdrawal.

## Existing failures retained

1. `test_get_review_preview_does_not_prioritize_current_users_review`: expects 3 preview reviews; implementation returns 2.
2. `test_preview_includes_user_review_outside_bounded_preview`: same preview-size mismatch.
3. `test_authenticated_merchant_cannot_like_review_on_own_business`: expects 400; implementation returns 200. Requires a product-policy decision before changing behavior.
4. `test_dismiss_dispute_without_admin_notes`: expects success; serializer requires notes.
5. `test_uphold_dispute_without_admin_notes`: same required-notes mismatch.
6. `test_dismiss_rejects_nonexistent_dispute`: missing notes trigger 400 before the requested 404 lookup.
7. `test_uphold_rejects_nonexistent_dispute`: same validation-order mismatch.

## Reproduction

From `sugbogo_backend`, run the following with a working backend Python environment:

```powershell
python manage.py test apps.reviews.services.tests apps.reviews.views.tests apps.admin_operations.moderation.services.tests apps.admin_operations.moderation.views.tests apps.users.services.tests.test_reputation_service apps.users.services.tests.test_reputation_interaction_integration apps.review_disputes.services.tests.test_review_dispute_service apps.review_disputes.views.tests.test_review_dispute_views apps.admin_operations.activity_management.tests --noinput
python manage.py makemigrations --check --dry-run
```

These results establish functional regression evidence. They are not a vulnerability assessment or a measured AI semantic-quality benchmark.
