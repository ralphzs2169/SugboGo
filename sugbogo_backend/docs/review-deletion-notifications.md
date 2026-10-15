# Review deletion closure notifications

Author deletion uses the existing notification model, event service and inbox APIs.
No notification schema, review status, case status or endpoint is added.

## Recipients and wording

For each still-pending community report, its submitter receives:

- Type: `review_report_closed_by_author`
- Title: `Report closed`
- Body: The review you reported was removed by its author. Your report has been
  closed without an Admin decision.
- Deduplication key: `review-report:{report_id}:author-removed`

For each still-pending merchant dispute, its submitting merchant receives:

- Type: `review_dispute_closed_by_author`
- Title: `Review dispute closed`
- Body: The review you disputed was removed by its author. Your dispute has been
  closed without an Admin decision.
- Deduplication key: `review-dispute:{dispute_id}:author-removed`

The deleting author never receives a self-deletion closure notice, including for
legacy self-submitted cases. Resolved reports/disputes and reviews without pending
cases generate no new closure notices. No reward, penalty or merits decision is
created. Messages contain no review text, evidence, report explanations or identity
of the deleting author.

## Atomicity and delivery

Deletion keeps the lock order Review, pending reports ordered by ID, then pending
disputes ordered by ID. Recipient IDs are read from those locked rows. The same
snapshot supplies the independent author-removal audit. Recipient accounts are
loaded together; only IDs/statuses remain in the audit, not copied account details.

Notification persistence uses `NotificationService.create()` and its database
recipient/event uniqueness constraint. Records commit or roll back with the audit,
hard deletion, counts, insights and media-cleanup registration. Persistence errors
propagate through the existing service transaction conventions. Concurrent deletion
cannot repeat the closure; concurrent Admin resolution that obtains the review
lock first keeps its actual outcome and is excluded from author-removal closure.

Inbox signals use the existing on-commit realtime publisher. A failed live signal
does not undo committed deletion: the REST inbox remains authoritative. There is
no new push/email transport or durable realtime-delivery queue.

## Targets and historical decisions

Closure notices use the supported non-navigable pair `target_type=""` and
`target_id=null`. Their deleted review/report/dispute is not a destination.

For older `review_dispute` notices, list/read responses expose that same empty pair
when the dispute no longer exists or does not belong to the recipient. The original
stored decision, body, timestamp and target remain unchanged. Inbox queries annotate
availability with a correlated Exists query to avoid per-item lookups. Other target
types keep their existing behavior.

Clients must honor the empty target. A previously cached target can disappear after
an inbox response; the existing dispute service then returns its controlled 404
envelope. No API can guarantee a target stays available after the response.

## Integration readiness and remaining dependencies

The backend deletion path supports retained publication states, stale AI retry
skips, independent audit history, preserved Admin decisions/reputation, insight
invalidation, and durable post-commit media cleanup. Existing ownership and active
account restrictions remain in place. My Reviews mobile integration is not part of
this change.

Deploy prior audit/cleanup migrations and current workers/Beat for media recovery.
The evidence-upload finalization race and audit/operational-record retention policy
remain separate dependencies. No Cloudinary refactor, notification framework,
reputation reversal, or serious-abuse investigation workflow is introduced here.
