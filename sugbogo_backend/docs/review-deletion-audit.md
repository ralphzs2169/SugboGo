# Review author-removal audit

Author deletion keeps the existing hard-delete behavior. Before cascading deletion,
`ReviewService.delete_review()` writes one independent `AdminActivity` event with
action `review_deleted_by_author`. This is an author action recorded in the
administrative/moderation history, not an Admin decision. `ACTOR_ID` identifies the
authenticated deleting author; `TARGET_USER_ID` identifies that same review author.
The existing history serializer exposes the actual actor and role. Existing Admin
decision action values and records are unchanged.

## Stored context

- `review_id`, `author_id`, `business_id`: scalar identifiers that survive cascade.
- `previous_review_status`: publication status under the deletion lock.
- `closure_reason`: `content_removed_by_author`.
- `pending_reports`, `pending_disputes`: ordered lists of case `id` and
  `previous_status`, containing only cases still pending under the locks.
- `ai_moderation_outcome`: present only for under-review submissions whose existing
  outcome is `flagged` or `provider_failure`.

`AACT_CREATED_AT` is the author-removal event timestamp, recorded before hard deletion
within the same transaction. It is not a timestamp of an Admin decision
or completed external-media erasure. The audit does not copy text, media, report
explanations, dispute evidence, installation IDs, reliability evidence, Admin notes,
or raw AI provider payloads. Existing resolved decisions remain in their original
independent audit records; they are not relabeled or duplicated into this event.

## Transactions and access

The lock order is Review, pending reports ordered by ID, then pending disputes
ordered by ID. Task 3B.1's review-first decision locks remain in place. Deletion
does not update case statuses before cascading: the audit records the logical
closure, without approving, rejecting, dismissing, or withdrawing any submission.
Audit and database deletion roll back together. The review lock prevents concurrent
deletions from recording the same removal twice.

Records use the existing Admin/Super Admin user-history endpoint and permissions.
No public or author-facing audit endpoint is added. Notifications, reputation,
and review insight/moderation task scheduling are unchanged. External media is
registered transactionally for durable post-commit cleanup as described in
`review-media-cleanup.md`.

## Retention dependency

The product must define a retention period and eventual disposal policy for this
minimal history alongside existing AdminActivity records. This change does not
establish indefinite retention as policy and does not introduce a purge system or
retain deleted evidence. Like existing history, actor/target user references use
PROTECT; retention/account-erasure policy must account for those references. A
retention duration cannot be inferred from current settings.

Cloudinary transaction safety and dispute-evidence cleanup are handled by Task 3B.3.
Author-removal closure notifications remain Task 3B.4.
