# Review completion gaps validation

Date: 2026-10-11 (Asia/Manila)
Branch: fix/review-completion-gaps
Base: origin/main at 82b9d9e

## Behavior

Review previews now order by creation time descending and review ID descending, providing deterministic ordering when timestamps are equal. The preview remains limited to two public reviews, with ownership metadata separate.

Following user approval, merchants cannot create new likes on reviews of their own business. Validation occurs before creating a like or updating its count. Existing likes are preserved and remain removable by their owner. No data cleanup or migration is included.

## Verification

The focused review service/API run passed 130 tests. After adding legacy-like preservation/removal coverage, the combined notification, review, dispute, admin moderation, activity-management, and merchant business-profile run passed all 466 tests against disposable PostgreSQL/PostGIS fixtures. The existing signed-JWT security benchmark is included. Django system checks passed.

A preview test explicitly assigns equal creation timestamps. Service checks verify rejected owner likes leave no new record/count changes and that existing likes remain until explicit removal. The existing API test now receives the expected HTTP 400.

Reproduction with a configured backend environment:

    python manage.py test apps.notifications apps.reviews apps.review_disputes apps.admin_operations.moderation apps.admin_operations.activity_management apps.merchant_operations.business_profile --noinput

## Limits

This branch does not implement AI image inspection, hold/clearance states, frontend report moderation, dependency vulnerability scanning, or production penetration testing. Ralph owns the AI image task. This is regression and authorization evidence, not a complete vulnerability assessment.
