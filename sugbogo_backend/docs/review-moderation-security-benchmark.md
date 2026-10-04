# Review moderation security benchmark

Date: 2026-10-04 (Asia/Manila)
Branch: `test/review-moderation-security`
Base: `e9c90b9` (`fix/review-edit-insight-invalidation`; merge that PR first)

## Method and scope

Local Django/DRF tests against a disposable PostgreSQL/PostGIS database. The seven new API checks use signed SimpleJWT access tokens through the configured authentication pipeline, rather than force-authenticated requests. Fixtures use accelerated password hashing in the ignored local runner. No deployed service was scanned and no production accounts or data were changed.

This is an automated regression benchmark, not a penetration-test certification. External AI/Cloudinary delivery, load testing, deployment configuration, dependency vulnerability scanning, mobile rendering of hostile text, and Ralph's unpublished AI moderation implementation were not assessed.

## Results

The combined review, dispute, moderation, and activity suite ran 427 tests: 420 passed, seven failed, no errors. All seven new security benchmark tests passed. Django system checks reported no issues.

| New check | Result |
| --- | --- |
| Explorer JWT plus spoofed actor/role cannot approve a report | Pass, 403; no state/audit/reputation changes |
| Existing admin JWT loses queue access after role revocation | Pass, 403 |
| Existing admin JWT loses decision access after account disablement | Pass, 401 |
| Expired JWT cannot read report evidence | Pass, 401 |
| Modified JWT signature cannot read the queue | Pass, 401 |
| Review author cannot assign status, author, or sentiment through PATCH | Pass; protected fields preserve authoritative values |
| Another user cannot edit/delete a review or delete its photo | Pass, 403; records unchanged |

Existing tests also exercise report-decision rollback, concurrent sibling approvals, one author penalty per review, independent reporter rewards, self-report reward exclusion, role permissions, upload size/count/format validation, and evidence privacy. The combined suite includes these existing checks; it does not measure every possible attack.

## Unresolved baseline findings

These seven failures match the previously recorded baseline. No production behavior was changed in this benchmark branch.

- Two review-preview tests expect three items; implementation returns two. Align the intended preview contract before changing assertions or production behavior.
- Four dispute-decision tests expect success without notes or a 404 without valid notes. Current API requires notes and validates them before resolving the ID. Update the tests to exercise the intended contract rather than weakening required audit notes.
- `ReviewLikeViewTests.test_authenticated_merchant_cannot_like_review_on_own_business` expects 400 but receives 200. This verifies an own-business engagement policy mismatch. Confirm whether own-business review likes should be prohibited before implementing a fix; severity depends on the intended reputation/ranking rules.

## Reproduction

From `sugbogo_backend`, using a working backend environment with configured PostGIS/GDAL/GEOS and disposable test-database creation privileges:

```powershell
python manage.py test apps.admin_operations.moderation.views.tests.test_review_security_benchmark --noinput
python manage.py test apps.reviews apps.review_disputes apps.admin_operations.moderation apps.admin_operations.activity_management --noinput
```

The recorded combined run used the ignored `venv/review-moderation/run_tests.py` launcher described in `review-moderation-consistency-validation.md`. The standard commands retain normal password hashing and may take longer. The broader suite currently exits unsuccessfully for the seven listed baseline failures.

## Follow-up

Resolve the baseline contract/policy decisions, retain the JWT boundary checks, and rerun after AI hold integration. Obtain a separate deployment-level vulnerability assessment before describing these regression results as a complete vulnerability test result. Review moderation remains Partial pending that assessment and the unpublished image-inspection/clearance workflow.
