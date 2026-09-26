# Review insights API contract

Business review insights are returned in the `review_insights` property of the
existing public and administrator business-detail responses. The endpoint only
reads the stored `BusinessReviewSummary`; it does not call Gemini or regenerate
insights during a request.

## Fields

| Field | Meaning |
|---|---|
| `state` | `pending`, `insufficient_reviews`, `ready`, or `outdated` |
| `state_message` | Display-safe explanation of the current state |
| `content_available` | Whether `narrative` and `frequent_mentions` may be shown |
| `narrative` | Generated overall review summary, or `null` when unavailable |
| `review_count` | All eligible reviews in the sentiment window, including blank-text reviews |
| `eligible_review_count` | Nonblank reviews eligible for narrative generation |
| `analyzed_review_count` | Eligible reviews included in the generation sample |
| `classified_review_count` | Reviews included in the sentiment percentage denominator |
| `is_sampled` | `true` when only part of the eligible nonblank set was analyzed |
| `sentiment` | Positive, neutral, and negative counts and percentages |
| `frequent_mentions` | Generated keyword labels and counts; evidence review IDs are private |
| `coverage_start`, `coverage_end` | Time window represented by the generated content |
| `generated_at` | When narrative and mentions were generated successfully |
| `updated_at` | Last database update to the stored summary |

Administrator detail responses also include `sentiment_computed_at` and
`keywords_processed_at` for operational diagnosis.

## Ready example

```json
{
  "state": "ready",
  "state_message": "Review insights are ready.",
  "content_available": true,
  "narrative": "Visitors often praise the friendly service and local dishes.",
  "review_count": 240,
  "eligible_review_count": 240,
  "analyzed_review_count": 100,
  "classified_review_count": 232,
  "is_sampled": true,
  "sentiment": {
    "positive": {"count": 180, "percentage": 77.59},
    "neutral": {"count": 32, "percentage": 13.79},
    "negative": {"count": 20, "percentage": 8.62}
  },
  "frequent_mentions": [
    {"label": "friendly service", "count": 38},
    {"label": "local dishes", "count": 27}
  ],
  "coverage_start": "2026-08-27T08:00:00Z",
  "coverage_end": "2026-09-26T08:00:00Z",
  "generated_at": "2026-09-26T08:01:10Z",
  "updated_at": "2026-09-26T08:01:10Z"
}
```

When `is_sampled` is true, the frontend can render a disclosure such as
"Based on 100 of 240 eligible recent reviews."

## State handling

| State | Content behavior | Recommended presentation |
|---|---|---|
| `pending` | Narrative is `null`; mentions are empty | Show the supplied generation message or a loading placeholder |
| `insufficient_reviews` | Narrative is `null`; mentions are empty | Show the supplied minimum-review message |
| `ready` | Narrative and mentions are current | Display the generated content and coverage dates |
| `outdated`, content available | Retained content is returned | Display it only with the supplied outdated message |
| `outdated`, content unavailable | Narrative is `null`; mentions are empty | Show the supplied invalidation message |

Use `content_available` as the rendering gate. Do not infer availability from
counts, timestamps, or the presence of sentiment data. Sentiment remains
available independently because it is computed locally and may be newer than
the generated narrative.

## Frontend acceptance checks

1. Render the narrative only when `content_available` is true.
2. Label retained `outdated` content clearly; never present it as current.
3. Show `state_message` when generated content is unavailable or outdated.
4. Show sampling disclosure when `is_sampled` is true.
5. Treat a missing summary (`review_insights: null`) separately from a summary
   that exists in a non-ready state.
6. Do not expect supporting review IDs, generation fingerprints, or retry flags
   in public or administrator responses.
