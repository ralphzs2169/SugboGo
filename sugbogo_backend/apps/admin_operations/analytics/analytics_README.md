# Merchant Application Analytics

The merchant application analytics module provides the aggregate metrics, weekly trends, and daily KPI history used by the admin dashboard.

The analytics are intentionally based on the application's domain model rather than treating every review, submission, and application as interchangeable. Resubmissions are handled as separate submission/review events where the metric represents workflow activity, while application-level rates avoid double-counting the same application when appropriate.

## Metric Definitions

| Metric | Definition | Counting Rule |
|---|---|---|
| **Pending Review** | Applications currently awaiting administrator review. | Counts applications whose current status is `SUBMITTED`. |
| **Approved** | Applications currently approved. | Counts applications whose current status is `APPROVED`. |
| **Rejected** | Applications currently rejected. | Counts applications whose current status is `REJECTED`. |
| **Total Applications** | Applications included in the reviewable application population. | Counts applications with status `SUBMITTED`, `APPROVED`, or `REJECTED`. |
| **Approval Rate** | Percentage of decided applications that are approved. | Each application is counted once using its current final status. Draft and submitted applications are excluded. |
| **Resubmission Rate** | Percentage of rejected applications that have been resubmitted. | Each rejected application is counted once, regardless of how many times it was resubmitted. An application is considered resubmitted when its submission count is at least 2. |
| **SLA Compliance Rate** | Percentage of completed review events resolved within the configured review SLA. | Each persisted review result is counted independently. |
| **Pending Review This Week** | Number of application submissions that entered the administrator review queue during the current week. | Each submission is counted independently, so resubmissions are included separately. |

## Weekly Trends

Weekly trends compare the current week with the equivalent elapsed portion of the previous week.

The current period starts on Monday and ends on today's date. The previous period starts on the preceding Monday and ends after the same number of elapsed days.

For example, if today is Friday, the current period is Monday through Friday and the previous period is the preceding Monday through Friday.

### Trend Output

```text
{
    "value": <absolute change>,
    "direction": "up" | "down" | "unchanged",
    "unit": "count" | "percentage_points",
}
```

Rate-based trends use **percentage points**, not relative percentage change.

A trend is not returned when either comparison period has fewer observations than `ANALYTICS_MINIMUM_TREND_SAMPLE_SIZE`.

## Approval Rate Trend

The approval-rate trend evaluates approval and rejection reviews within each period.

Each application is counted once per period using its latest review in that period. This prevents an application that was rejected and later approved from contributing multiple times to the same period's approval-rate denominator.

## Resubmission Rate Trend

The resubmission-rate trend uses:

- **Denominator:** applications that received a rejection review during the period.
- **Numerator:** those rejected applications that also had a second-or-later submission during the same period.

Each application is counted once per period.

This differs from the overall resubmission rate, which uses the application's current submission count across the full rejected-application population.

## SLA Compliance

The configured merchant application review SLA is defined in `apps.merchant_application.constants`.

The analytics service consumes:

- `APPLICATION_REVIEW_SLA_BUSINESS_DAYS`
- `APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS`

The actual compliance result is persisted on each `MerchantApplicationReview` as `MAREV_SLA_COMPLIANT`.

This means historical analytics do not need to recalculate the SLA later.

### Review Event Independence

SLA analytics treat each completed review as an independent event.

For example:

```text
Submission #1 → Rejected → SLA result #1
Submission #2 → Approved → SLA result #2
```

Both review events contribute independently to SLA analytics.

This is important because a resubmitted application can have a different review turnaround time for each submission.

### SLA Trend and History

SLA trend and daily history only use completed reviews that:

- have a linked submission,
- have a persisted `MAREV_SLA_COMPLIANT` result, and
- have a review timestamp within the requested period.

The overall SLA compliance rate uses persisted non-null SLA results directly.

## Daily KPI History

The dashboard sparklines use the most recent **7 calendar days**, including today.

Each history entry has this structure:

```text
{
    "date": "YYYY-MM-DD",
    "value": <number> | null,
}
```

A `null` value means there were no observations for that date. It is intentionally preserved rather than converted to zero.

### Pending Review History

At each historical date, a submission is considered pending when:

1. It was submitted on or before that date.
2. It had not received a review by that date.

Submissions are evaluated independently, so resubmissions are represented as separate pending submission events.

### Approval Rate History

For each day:

- Only approval and rejection reviews from that day are considered.
- Each application is counted once using its latest review for that day.

This prevents multiple review events for the same application from inflating the daily approval-rate denominator.

### Resubmission Rate History

For each day:

- The denominator is applications that received a review on that day.
- An application contributes to the numerator if it had a second-or-later submission by that historical date.

Each application is counted once for that day.

### SLA Compliance History

For each day:

- Completed review events are grouped by review date.
- Each review contributes its persisted SLA-compliance result independently.

Resubmission reviews therefore contribute separately to the daily SLA rate.

## Application Population

The aggregate application statistics use the following reviewable statuses:

```text
SUBMITTED
APPROVED
REJECTED
```

Draft applications are excluded from the reviewable application population.

## Empty and Insufficient Data

Analytics methods avoid inventing values when there is no meaningful data.

Depending on the metric:

- A rate with no denominator returns `null`.
- A daily history point with no observations returns `null`.
- A weekly trend returns `null` when either comparison period has insufficient observations.
- Pending-review counts can legitimately be `0`.

The frontend can therefore distinguish between:

```text
0     → there were zero observations/counts
null  → there was not enough applicable data to calculate the metric
```

## Dashboard Usage

`get_application_statistics()` is the main aggregation entry point for the admin application statistics endpoint.

It returns:

- application counts,
- current KPI rates,
- weekly trends,
- pending-review activity for the current week,
- seven-day KPI histories, and
- the configured review SLA thresholds.

The frontend uses these values for the Merchant Applications dashboard KPI cards, trend indicators, sparklines, and SLA information panel.

## Tests

Analytics tests are located under:

```text
apps/admin_operations/analytics/tests/
```

The tests cover aggregate metrics, weekly trends, historical KPI values, SLA behavior, sample-size protection, and resubmission handling.

When changing an analytics definition, update the corresponding tests and this README together so the documented business meaning remains aligned with the implementation.
