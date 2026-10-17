# Analytics interpretation policy

Branch: `feat/analytics-policy-configuration`, based on verified main `e09a923a`.
Approved implementation scope and ranges: 15 October 2026, Asia/Manila.

## Purpose and boundaries

One persisted policy governs existing analytics interpretation/sample rules. It is separate from Discovery Algorithm and Recommendation Algorithm configuration. Raw healthy counts remain visible; missing tracking remains unavailable/partial. Raising a sample threshold cannot prove tracking completeness, restore deleted history, or enable visibility growth comparisons. No Premium entitlement, business status, moderation, sentiment classifier, or Discovery Score calculation changes in this branch.

The existing `system_configuration` app is reused. No dependency or Django app is added. Settings do not trigger LLM calls, enqueue a mass summary regeneration, or write summaries during GET requests. Existing asynchronous generation reads this policy and records its original revision/rules.

## Editable controls

| Public field | Initial value | Allowed integers | Unit / application |
|---|---:|---:|---|
| `sentiment_min_classified_reviews` | 5 | 5–1000 | Classified reviews for public Vibe and merchant sentiment conclusions |
| `narrative_min_eligible_reviews` | 5 | 5–100 | Eligible nonblank reviews for generation and content display |
| `mention_min_supporting_reviews` | 2 | 2–100 | Distinct supporting reviews per frequent mention |
| `peer_min_businesses` | 5 | 5–100 | Other eligible businesses; applies to selection and qualifying positive-share peers |
| `peer_positive_share_min_reviews` | 5 | 5–1000 | Classified reviews for the merchant and each positive-share peer |
| `low_exposure_max_profile_visits` | 4 | 0–100 | Recorded visits in the fixed low-exposure window |
| `low_exposure_min_distinct_supporters` | 5 | 5–1000 | Current distinct valid specialty supporters |
| `onboarding_comparison_min_sample` | 10 | 10–1000 | Observations in each existing comparison period |

Ranges are approved initial product safeguards, not statistical/industry standards. Each setting is independently bounded; a larger mention minimum can legitimately produce no mentions from a smaller narrative sample. Narrative sampling still caps at 100 reviews.

Fixed controls are read-only metadata: 30 completed Manila days for low exposure, today excluded, generation sample cap 100, and no configurable tracking-coverage override. Existing UTC deduplication, counts, denominators, equal-elapsed-period helpers, and rate units retain their established definitions.

## Settings APIs

All three operations require an authenticated active **Super Admin**, following the existing settings-role boundary. Ordinary Admins, Merchants, and Explorers cannot use the settings/history endpoints. Affected analytics keep their existing role/Premium gates and business ownership checks.

- `GET /api/admin/settings/analytics-policy/`
- `PATCH /api/admin/settings/analytics-policy/`
- `GET /api/admin/settings/analytics-policy/history/`

The old `/api/admin/settings/` placeholder remains intact. History uses `core.pagination.StandardPagination`, newest revision first; there are no audit edit/delete endpoints. Audit immutability is an API guarantee, not a new database trigger or protection against privileged manual SQL changes.

GET returns the normal `success/message/data` envelope. `data` includes:

- `version`: current monotonic revision, initially 1.
- `updated_at`: configuration update time; there is no scheduled activation.
- `values`: the eight integer settings above.
- `schema`: each field's label, unit, default, minimum, and maximum.
- `fixed_policy`: non-editable definitions for frontend explanation.

PATCH example:

```json
{
  "expected_version": 1,
  "reason": "Require six businesses before displaying peer comparisons.",
  "values": {"peer_min_businesses": 6}
}
```

Use JSON integers, not strings, booleans, or decimals. Send only edited values. A nonblank reason (maximum 1000 trimmed characters) and positive integer `expected_version` are required. Unknown top-level fields, unknown settings, fixed controls, unsafe ranges, and empty changesets return validation errors.

The backend locks the singleton, verifies the version, validates the merged settings, then atomically saves the policy and audit record. A genuine change increments the version once; a no-op returns `changed: false` without changing timestamp/history. Success returns refreshed GET-shaped data plus `changed`.

Conflicts return HTTP 409 with `code: ANALYTICS_POLICY_VERSION_CONFLICT`. Missing/unreadable/invalid policy reads return HTTP 503 with `code: ANALYTICS_POLICY_UNAVAILABLE`. Reads never create defaults or silently substitute weaker rules. Initial defaults come only from the migration seed.

History entries include version, administrator ID snapshot, reason, before/after values, and timestamp. No user profile or review-evidence identities are returned. The administrator ID snapshot remains after deleting that administrator; the FK can become null.

## Consumer consistency and stored review provenance

A lazy request-local policy boundary reads once when needed and resets after the request. It is not a process-wide cache; another worker/request sees committed updates on its next read. Direct composed reports and generation batches also use scoped snapshots.

- Peer selection and positive-share samples use their separate configured minimums. Group metadata exposes revision and thresholds; other business names remain excluded.
- Low-exposure responses disclose the actual policy revision and numeric cutoffs used. The reporting window is still fixed; inventory/valid-support definitions are unchanged.
- Onboarding interpretation reads the configured sample minimum. This is the explicit change to the earlier “reuse as-is” task: legacy populations, UTC windows, SLA definitions, count-change semantics, and history remain unchanged. Metadata discloses the applied revision/minimum.
- Public stored insights, merchant sentiment trends, and model-derived Vibe use the same classified-review minimum. Counts/shares retain their existing denominators and remain independent of whether a conclusion is eligible.
- Generation eligibility, provider instructions, evidence validation, and fingerprints use the effective narrative/mention rules. Relevant rule changes during generation prevent publication of that in-flight output; unrelated setting changes do not force review narrative regeneration.
- New stored generation/insufficient-data decisions record `BRSU_GENERATION_POLICY_VERSION` and the original relevant rules. Existing rows retain null revision/empty rules, indicating unknown provenance. No historical revision is invented.
- Existing review-insights responses add `policy`: current revision, original generated revision, provenance, relevant-rule compatibility, and current thresholds. A revision difference alone is not proof that review rules changed; compare the relevant stored rules. Content from incompatible rules is labeled outdated; narrative below the current minimum is withheld, and mentions below the current support minimum are filtered. GET reads do not rewrite original state, counts, dates, or provenance.
- Retained original content can still be displayed as outdated when permitted by the existing evidence state and current rendering minimums. No polarity is invented for mentions.
- Legacy `ReviewKeywordService.MIN_*` attributes remain fixed defaults for evaluation dataset fixtures, not live policy controls. Existing evidence schema/sampling limits and model-evaluation fixtures are not editable through this API.
- Standard merchant responses do not acquire premium comparisons or premium result fields.

These changes extend the existing stored-review API contract and analytics definitions; they are not a change to sentiment classification, administrative moderation decisions, or ranking logic.

## Migrations and deployment

Two **new** migration files were created, as requested:

| App | New file | Dependency |
|---|---|---|
| `system_configuration` | `0006_analytics_policy_configuration.py` | Existing `0004_recommendationalgorithmconfiguration` and user model |
| `reviews` | `0021_review_summary_policy_provenance.py` | Existing `0019_review_reliability_check_outcome` |

The numbers deliberately advance two from the current maxima. No dummy `0005`/`0020` is created, and no old migration is edited. Filenames do not reserve slots or prevent graph conflicts: if Ralph adds a sibling migration from the same predecessor, inspect both operations and create a separately reviewed merge migration before deployment.

The configuration migration creates the policy/audit tables and seeds revision 1 with frozen approved values. The reviews migration adds nullable/empty provenance fields, leaving existing summaries' provenance unknown. Runtime definitions are not imported by the seed migration.

Generating these files did not apply them to the application database. Tests require only a disposable PostgreSQL/PostGIS database; applying migrations to the application database is a separate deployment action needing approval. Updated endpoints require the new schema and seeded policy before normal use. Rollback that removes the new tables also loses their policy/audit data; preserve needed records before an application rollback.

## Frontend integration for Ralph

1. Keep this under Super Admin settings; retain API permissions even when a control is hidden.
2. GET current configuration and render numeric controls using the returned labels, units, bounds, and defaults. Explain fixed rules rather than offering toggles for coverage or Discovery Score.
3. Preserve the loaded version and edited values; require a reason before saving.
4. PATCH the changes with that version. On success replace the form baseline with the returned values/version.
5. On 409 reload/review the latest configuration before retrying; do not blindly overwrite it with the old form.
6. Distinguish unavailable configuration from defaults. Do not render failed GETs as zero or silently reset fields.
7. Show the paginated revision history with before/after values and reason.
8. In affected analytics, display insufficient-data and outdated-content states using the returned thresholds and policy metadata. Original generation revision/date must not be relabeled as the latest revision.

The frontend configuration page itself is not implemented in this backend branch.

## Verification plan and recorded state

New tests cover seeded defaults/read-only reads, missing/corrupt configuration, strict ranges and protected controls, Super Admin access, no-op behavior, stale forms, atomic audit rollback, PostgreSQL simultaneous writers, request-snapshot isolation, and consumer effects on reviews/peers/low exposure/onboarding. Provider generation is mocked; no live Gemini request is part of these tests.

Recorded results on 15 October 2026:

- All 705 combined configuration, admin analytics, merchant analytics, review, and public review-insight tests passed against a disposable PostgreSQL/PostGIS database (286.571 seconds). This includes simultaneous policy updates, permissions, audited rollback, snapshot isolation, and consumer threshold behavior.
- `python -B manage.py makemigrations --check --dry-run` passed with no changes detected.
- `python -B manage.py check` passed with no issues.
- Syntax parsing of ten new policy/migration files and the final tracked whitespace check passed.

The first combined run exposed outdated test expectations, an offline evaluator's unintended policy-database read, and historical migration tests using current models against older schemas or leaving subsequent tests at an older schema. The repairs keep benchmark parsing on its fixed support threshold, update fixtures/contracts for configurable policy, create migration source records before schema rollback, and restore all current migration heads after historical checks. No applied migration file was modified. The successful rerun replaced the initial failed verification result.

The test runner applied the new migrations only to its disposable database and removed that database afterward. The application database has not been migrated. No live Gemini request or frontend acceptance test was performed.

Before merge, reconcile current main and any concurrent migration heads, run the relevant combined analytics/review regressions, verify settings UI error handling, and separately approve application migration/deployment. Live tracking completeness, real-device offline acceptance, and the later AI recommendation/heatmap tasks remain separate work.
