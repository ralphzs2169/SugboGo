# Review Reliability in SugboGo

## Introduction

Community reviews help Explorers decide where to go and help businesses understand their customers. Repeated wording or unusual bursts of reviews can make that information harder to trust. SugboGo's Review Reliability module looks for three such patterns and records them for administrator investigation.

A suspicious activity signal is **a reason to look more closely, not a finding that a review is false or that its author acted improperly**. The module does not decide whether a review is genuine, reject it, or penalize anyone. Administrators assess the available context, including explanations that a simple pattern cannot provide.

## Objectives

The module aims to:

- Notice unusually frequent review submissions from one app installation.
- Identify repeated review text associated with the same author or installation across businesses.
- Recognize when several accounts associated with one installation review the same business.
- Preserve the observations that led to a signal so an administrator can understand why it appeared.
- Give legitimate reviewers fair treatment by keeping signals advisory rather than treating them as proof of abuse.

## How it works

1. An Explorer submits a review. SugboGo checks its text and, when an installation identifier is available, its relationship to other reviews associated with that installation.
2. SugboGo records any detected signals and the supporting observations at the time of the check. A successful check with no signals is also a valid result.
3. The review follows the separate content moderation process. A reliability signal does not decide whether the review is published.
4. **Published reviews with recorded signals** appear in **Admin → Moderation & Integrity → Suspicious**. Administrators can inspect the review, the original observations, and related activity still visible in the system.

If an author later changes the review text, SugboGo can check for a **new duplicate-content signal**. It does not rerun the two installation-based submission checks on edits. A duplicate signal already recorded for that review is retained rather than replaced by a later edit. Edits to photos or other review settings alone do not create a new successful reliability check.

## The three suspicious activity signals

| Signal | What triggers it | Scope |
| --- | --- | --- |
| **Duplicate Content** | The review text matches **at least two earlier reviews** from the same author or installation, each for a business different from the current review's business. | Earlier reviews submitted within the **30 days before detection**. Can first be detected on submission or a later text edit. |
| **Rapid Submission** | **More than 10 reviews** are associated with the same installation during the observation window. The newly submitted review is included in the count, so the **11th** can trigger it. | The **24 hours ending when the check runs**. Checked on submission. |
| **Shared Installation Accounts** | **More than three distinct accounts** associated with the same installation have reviewed the **same business**. The new review's account is included, so the **fourth distinct account** can trigger it. | No rolling time limit. Checked on submission. |

An installation identifier must be present for the two installation-based signals. The checks use reviews retained in SugboGo, including reviews whose publication status may later change. The signals do not mean the listed people are the same person.

Here, an **installation** means a particular installation of the SugboGo app. Its identifier helps relate activity sent from that app installation; it does not verify who held or used the device. Retained reviews can contribute to a pattern even if they are under review or rejected, because a publication decision does not erase the earlier activity.

### Duplicate Content

SugboGo compares review wording after ignoring differences in letter case and extra spacing. Other wording and punctuation still matter. The comparison looks for two **prior** exact matches associated with either the same author or the same app installation. Each prior match must concern a business other than the one being reviewed now.

For example, an Explorer posts “Friendly staff and quick service” for Café A and later posts the same wording for Café B. Those two reviews alone do not meet the rule for the second review. If a third review for Café C repeats the wording within 30 days, the third review can receive a Duplicate Content signal. A later text edit can also be the point when this signal first appears.

People may honestly use the same short description for different experiences. The signal invites investigation; it does not prove copying, fabrication, or a policy violation.

### Rapid Submission

SugboGo counts reviews associated with one app installation in the 24 hours ending when a new review is checked. When that count exceeds 10, the new review receives a Rapid Submission signal. The count is across the installation, not limited to one account or one business.

For example, ten eligible reviews have been submitted from one installation since yesterday afternoon. Another review from that installation is submitted within the same 24-hour period. That eleventh review can be flagged. A shared device or a genuinely active reviewer could also produce frequent submissions, so administrators should examine context before drawing conclusions.

### Shared Installation Accounts

SugboGo counts **different accounts**, rather than the number of reviews, associated with one installation that reviewed the same business. A fourth distinct account triggers the signal. There is no 24-hour or 30-day limit for this particular count.

For example, three household members use one tablet to review a restaurant through their own accounts. A fourth account using that tablet reviews the same restaurant later. The new review can be flagged even if the activity was legitimate. The installation identifier connects app activity; it is **not proof that the accounts belong to one person**.

## Reliability Check results

The check result describes whether an applicable assessment completed. It is separate from the list of detected signals.

| Result | Meaning for an administrator |
| --- | --- |
| **Checked** | The applicable assessment completed. It may have found signals or none. |
| **Unavailable** | An attempted assessment could not be completed. This is neither a clean result nor evidence of misconduct. |
| **Unknown** | The completion result was not recorded, particularly for older reviews. |

An older review can have a recorded suspicious signal while its check result says **Unknown**: the signal was stored, but the newer completion-result field did not exist when that review was assessed. A failed check on a later text edit can also leave earlier signals intact while the latest applicable check is **Unavailable**.

Reliability-check failures do not, by themselves, hold or reject a review. A later eligible text edit may allow the duplicate-content check to run successfully, but the module does not provide an automatic background retry for failed reliability checks.

## Admin Suspicious workspace

Administrators and Super Admins open **Admin → Moderation & Integrity → Suspicious** to investigate published reviews with recorded signals. The workspace is read-only: it provides evidence and context, not a reliability-specific approval or rejection decision.

The **left queue** shows a compact review preview, author, business, submission time, and signal labels. Administrators can search, filter by signal, sort, and select a review. The **right investigation panel** shows the review's identity, publication status, complete content, photos and other available review context.

The investigation panel then separates four questions:

- **Suspicious Activity Signals:** Which of the three patterns were recorded?
- **Reliability Check:** Did the applicable assessment complete, fail, or have an unknown historical result?
- **Why This Review Was Flagged:** What was observed when each signal was first detected? Depending on the signal, this can include a count, observation time, matching-review references, or whether duplicate content was detected during submission or editing.
- **Current Related Activity:** Which related reviews and accounts can still be found now? Administrators can compare these live records with the original observations. Where a historical matching review is still available, **View review** takes the administrator to that related item in the panel.

An older record may lack some detection details. The workspace identifies missing evidence or an unavailable historical time window rather than inventing a date or claiming that the signal was observed during a specific stage without support.

## Historical evidence and current activity are different

**Why This Review Was Flagged** reflects observations stored when a signal was detected. For a duplicate-content signal, it records the prior-match count and references; for rapid submissions, it records the count and 24-hour observation period; for shared-installation accounts, it records the distinct-account count. These historical observations are not replaced whenever an administrator opens the page.

**Current Related Activity** looks at related reviews still retained now, using the signal's original observation window where a timed window applies. The two views may disagree without either being erroneous.

For example, a duplicate match is recorded when a review is edited on October 10. The investigation's 30-day window is anchored to **October 10**, the detection time, rather than to the review's earlier submission date. If one matching review is later edited, rejected, or deleted, the stored observation remains, while the live list or a matching review's current status may differ. A deleted historical reference may be shown as unavailable. Administrators should read the stored observation as what was known **then** and the related activity as what can be seen **now**.

## Relationship to other moderation features

| Area | Its question | Relationship to Review Reliability |
| --- | --- | --- |
| **Under Review** | Is the review's content suitable for publication? | Content moderation has its own publication workflow. A reliability signal does not make this decision. |
| **Reported** | What should happen to a review that community members reported? | Community reports are separate allegations and are resolved through the Reported workflow. |
| **Disputes** | How should an administrator resolve a merchant's challenge to a review? | A dispute has its own evidence and decision process. Reliability signals may provide context but do not resolve it. |
| **Suspicious** | What unusual submission patterns were detected? | This is a read-only, advisory investigation workspace. |

The same review can be involved in more than one workflow. If another moderation process rejects it, its reliability observations remain historical, but a rejected review no longer appears in the **active Suspicious queue**, which is limited to published reviews. The reliability module does not automatically resolve reports or disputes, change a business's review count, or apply an account penalty.

## Practical scenarios

| Scenario | What SugboGo records | What the administrator sees and what it means |
| --- | --- | --- |
| **Ordinary review** — An Explorer writes a distinct review and the applicable checks complete. | **Checked**, with no suspicious signals. | It does not appear in the Suspicious queue. This is a clean pattern check, not a guarantee that every statement in the review is true. |
| **Repeated wording** — A third matching review is submitted for a different business within 30 days, associated with the same author or installation. | **Duplicate Content**, with the prior matches observed at detection. | The administrator can inspect the wording and available matching reviews. Repetition alone does not prove misconduct. |
| **Many reviews in one day** — An installation reaches its eleventh review within 24 hours. | **Rapid Submission**, with the observed review count and time period. | The administrator sees a burst of activity, but a shared device or legitimate use remains possible. |
| **Several accounts on one installation** — A fourth distinct account associated with one installation reviews the same business. | **Shared Installation Accounts**, with the distinct-account count. | The administrator sees a relationship between app activity, not proof of common identity or coordination. |
| **Related activity changes later** — A duplicate was detected, then a prior matching review is edited or removed. | The original signal and detection-time observations remain recorded. | Current Related Activity can show fewer matches or an unavailable historical reference. The difference reflects later changes, not an automatic withdrawal of the original observation. |
| **Check could not finish** — The assessment fails during submission and finds no recorded signal. | **Unavailable**, without invented reasons or evidence. | The review does not enter the Suspicious queue solely because the check failed. Its publication status still follows content moderation. The failed check must not be read as either a clean bill of health or suspicious conduct. |

## Benefits

Review Reliability makes unusual activity more visible without hiding the reasons an administrator is seeing it. Stored observations support transparency and later investigation. Separating historical evidence from live activity helps administrators avoid treating changed records as a contradiction. Keeping the signals advisory protects legitimate reviewers from automatic punishment based on a pattern that may have an innocent explanation. Together, these practices support informed administration and community trust without claiming to guarantee review authenticity.

## Limitations and responsible use

- The three signals cover specific patterns. They do not detect every misleading review or establish whether any individual review is truthful.
- Legitimate people may reuse wording, post many reviews, or share a device. An installation identifier is correlation information, not verified personal identity.
- Installation-based signals cannot be assessed without a usable installation identifier.
- Older reviews may have signals but incomplete detection details or an **Unknown** check result. A missing or invalid historical observation time can make a comparable live time window unavailable.
- Current related activity depends on reviews still retained and their present content and status. It may differ from the original detection-time counts and references.
- The active Suspicious queue covers **published** reviews with recorded signals. An unavailable check alone does not create a queue item, and reviews no longer published are not shown there.
- The module does **not** automatically reject, remove, hold, or penalize a review or account; it does not resolve community reports or merchant disputes. Content moderation and those other decisions remain separate.

Administrators should use the signals as a starting point, consider the review and surrounding evidence, and avoid interpreting an absence of signals as proof of authenticity.
