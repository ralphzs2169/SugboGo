# Review edit insight invalidation

Date: 2026-10-04 (Asia/Manila)
Branch: `fix/review-edit-insight-invalidation`
Updated base: `0f96f1f` (latest pulled main, including moderation consistency and report resolution)

## Behavior

When review text actually changes, the existing edit transaction clears its sentiment score/label. This branch immediately recomputes the business sentiment distribution without the old classification and clears the stored narrative/themes if they cite the edited review. The existing supporting-evidence helper marks that generated bundle outdated. Existing eligible-window and moderation rules are preserved.

After commit, the existing sentiment task scores the latest text, updates the sentiment distribution, and queues insight regeneration on successful scoring. Existing source-text and snapshot fingerprint checks protect against stale inference/generation. Photo-only edits and unchanged text preserve generated insights. Transaction rollback restores the prior review and summary and discards the rescoring callback.

There are no new endpoints, migrations, dependencies, notification hooks, or AI hold changes. Rescoring and regeneration remain asynchronous; broker/provider failures can delay fresh content, but old supporting content is invalidated synchronously. Daily reconciliation remains available.

## Validation

- Before the fix: 3 new tests, with the immediate-invalidation regression failing because the stored positive count remained 1.
- After the fix: 130 tests across review CRUD and insight services/tasks, with only the known preview-size failure (`test_get_review_preview_does_not_prioritize_current_users_review`, expecting 3 instead of the implemented 2).
- Final focused run: 61 tests passed, including five new edit regressions plus keyword, sentiment, summary, and task tests.
- After the latest pull: 73 report-resolution and insight service/task tests passed, plus all five new edit regression tests. The new schema migrated successfully in the disposable test database.
- Django system checks and `git diff --check` passed.

Tests used PostgreSQL/PostGIS and the separate ignored test launcher described in `review-moderation-consistency-validation.md`; fixture hashing was accelerated locally. External model/provider delivery was mocked, not measured live.

## Reproduction

From `sugbogo_backend` with the configured backend Python environment:

```powershell
python manage.py test apps.reviews.services.tests.test_review_service apps.reviews.services.tests.test_review_keyword_service apps.reviews.services.tests.test_review_sentiment_service apps.reviews.services.tests.test_business_review_summary_service apps.reviews.services.tests.test_review_sentiment_task apps.reviews.services.tests.test_business_review_insights_task --noinput
```

This broader command includes the known preview-size failure. The final passing subset selects the five new edit tests instead of the entire ReviewServiceTests class, alongside the five insight service/task modules above.

## Merge coordination

Both prerequisite branches are now merged into main (PRs #113 and #114), and the latest main was pulled into this branch. The newly pulled commits did not modify the review app or report-resolution implementation. The production behavioral addition is localized to the text-changed block of ReviewService.update_review. Ralph may still modify the same handler or evidence helper for AI holds; review that overlap when his branch becomes available. Zero conflicts are not guaranteed.
