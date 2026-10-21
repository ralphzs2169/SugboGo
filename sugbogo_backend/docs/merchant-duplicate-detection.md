# Merchant duplicate detection

## Matching and privacy

The rule `exact-name-location-v1` requires an exact normalized name plus either
the same complete address or a geodesic distance within
`MERCHANT_DUPLICATE_RADIUS_METRES` (default 50). Unicode NFKC, case folding and
whitespace normalization preserve punctuation, branch labels and unit information.
Application addresses use street, unit, barangay, city and province; approved
Business addresses use the equivalent stored Location representation.

Distance uses PostGIS geography casts of existing SRID 4326 geometry. There is no
fuzzy matching, document hashing, OCR, or registration-identifier collection.
Only other submitted applications and active/suspended Businesses are material
candidates. Draft/rejected applications never reserve an identity. Approved
applications are represented through their Business, with an application-based
stable key where a link exists.

Mobile checks only saved details and reveals two booleans. It never returns
matching applications, accounts, documents, addresses or candidate IDs. Failed
checks remain unavailable rather than becoming successful negative checks.

## API contracts

All paths below are relative to `/api/`; responses retain the standard envelope.

- `GET merchant/application/duplicate-warning/`: authenticated current user's
  saved application; `data = {evaluated, possible_duplicate}`. Read-only.
- `GET admin/businesses/applications/{id}/duplicates/`: Admin/Super Admin only;
  returns `submission_id`, `candidates`, `approval_blocked`, and `disposition`.
  Each candidate contains a stable `key`, current `record_type`/`record_id`, name,
  full address, status, metres, reasons, rule/evidence, fingerprint, latest
  assessment, and `stale`/`resolved` flags. UI links use existing record routes.
- `POST` to the same duplicates path with `action: "assess"`, `submission_id`,
  `candidate_key`, `fingerprint`, `decision`, and `explanation`. Decisions are
  `unresolved`, `confirmed_duplicate`, `legitimate`, or `ownership_conflict`.
  All substantive decisions require an explanation. Stale evidence/submissions
  fail validation. Only a current legitimate assessment grants clearance.
- Existing `POST .../{id}/reject/` accepts `disposition: "duplicate"` and a
  required `explanation`, optionally alongside ordinary `feedback`. It requires
  a current confirmed duplicate assessment. Ordinary rejection still requires
  nonempty section feedback. No automatic duplicate rejection occurs.
- `POST .../{id}/duplicates/` with `action: "reconsider"`, `review_id`, and a
  required explanation is a deprecated compatibility operation. It records legacy
  reconsideration history only; resubmission no longer depends on this action.
- Merchant application detail adds privacy-safe `duplicate_disposition` separately
  from section feedback. It includes the rejection explanation and administrative
  reconsideration status/explanation.

## Evidence and lifecycle

Migration `0018_duplicate_business_review` follows
`0017_baseline_existing_rejections`. It adds submission-time candidate evidence,
append-only duplicate assessments, review-level duplicate rejection fields, and
an audited reconsideration record. Apply it before deploying the updated API.
It does not rewrite historical rejection fingerprints or grant legacy clearance.

Assessments are scoped to one submission and the normalized name/address/point
evidence on both sides, reasons, rule version and configured radius. Unrelated
description, hours, photo and landmark edits do not invalidate them. An
application becoming an approved Business preserves its key and evidence when
the actual business details are unchanged. New submissions require fresh
assessments. Removed candidates retain historical assessment records.

Duplicate rejection remains the existing `rejected` application status. Ordinary
feedback still needs actual saved corrections under the existing fingerprints.
Duplicate-only rejection permits immediate resubmission without fabricated edits.
Combined rejection still requires genuine changes to all ordinary feedback sections.
Every resubmission creates a new submission with fresh candidate evidence and no
inherited assessment clearance. Repeated unchanged duplicate-only resubmissions
are intentionally allowed; no cooldown or extra restriction is imposed. Ownership
conflicts remain blocking for approval. Historical reconsideration records, model,
response fields, and migration 0018 remain intact; no new migration is needed.

## Locking and protection scope

Approval, duplicate assessment and duplicate rejection acquire the PostgreSQL
transaction advisory lock `(736421, 1)` before User then MerchantApplication row
locks. Ordinary rejection and reconsideration retain User then application order
and do not wait for the advisory lock. No matching applicant rows are locked.
Both existing approval endpoints delegate to the same protected approval service.
Eligibility checks and all existing transactional side effects remain in place.

Final approval rechecks current matches before creating the approval review,
Location, Business or changing the applicant's role. Concurrent separate-account
approvals serialize and the second sees the first's committed Business. Callers
must not wrap a protected operation after acquiring account/application locks.
Current production callers are the two review views and the duplicate command view.

This protects participating merchant registration approvals. Approved business
name/location changes, seeds, Django admin writes, direct SQL, and other direct
Business creation paths do not join this lock protocol. They must not be assumed
to have a global uniqueness guarantee. No blanket database uniqueness is imposed
on names or locations, since legitimate branches and tenants can share them.

Exact Unicode normalization currently scans eligible names in Python and issues
metric queries for exact-name matches. At larger volumes, benchmark and consider
indexed persisted normalized names/geography expressions without changing rule
semantics. The global approval lock deliberately favors a simple correct
registration protocol over parallel approval throughput.

## Changed components

- Backend: `duplicate_detection_service.py`, `duplicate_review_service.py`,
  duplicate command serializers/views, merchant/admin URL registrations,
  application submission and approval/rejection services, application detail
  serializer, duplicate models/migration, settings and `.env.example`.
- Mobile: saved-evidence query/API/types, inline warning and duplicate rejection
  notice, registration screen, portal screen and rejected portal section.
- Admin web: duplicate API/query/mutation integration, `PossibleDuplicatesReview`,
  and the existing review page approval controls.
- Tests: backend matching/adjudication/concurrency modules, corrected submitted
  rejection fixture, mobile warning/hook coverage and portal focus mock, admin
  rendering states. Existing correction fingerprint code and migrations are
  unchanged.

## Verification notes

The targeted backend runs cover 179 registration/approval/lifecycle tests,
including real PostgreSQL concurrency. An older rejection fixture missing its
required identity was corrected and its entire 11-test module rerun successfully.
Five admin rendering tests and 15 targeted mobile tests pass. Django checks and
migration drift checks pass. The web production build succeeds with dependency
and bundle-size warnings.

The broader admin suite also exposed an unrelated existing insights response
assertion that omits the current `policy` field. Full mobile type checking is
blocked by malformed declarations in installed
`node_modules/tailwindcss/types/generated/colors.d.ts`. These dependency files
and the unrelated insights contract were not changed. Targeted lint has no
errors; the registration screen retains its existing `restoreDraft` effect
dependency warning. Manual device/browser interaction was not verified.

Deploy the migration before the updated backend, and coordinate the admin web
release so reviewers can resolve matches that now block approval. No migration
was applied to the primary application database during implementation.

## Simplified MVP decision contracts and rollout

The admin approval button and confirmation modal remain. The existing rejection
drawer handles corrections, confirmed duplicate rejection, and optional combined
ordinary feedback. Possible Duplicates only investigates and saves assessments;
it has no final rejection or Allow Resubmission action.

Application detail responses now include `latest_submission_id`. Updated clients
send `expected_submission_id` on POST approve, POST reject, and PATCH review.
The shared service validates it against the latest submission after existing locks
are acquired. A stale ID returns HTTP 409 `STALE_APPLICATION_SUBMISSION` and asks
for refresh. Legacy requests omitting it remain accepted only for the first
submission; after resubmission they fail closed with the same conflict. Update
admin clients before reviewing resubmissions. Internal service callers must also
supply the expected ID for subsequent submissions. No lock ordering changed.

Mobile clients must update their local eligibility check: reconsideration fields
are historical data, not an eligibility flag. Do not fabricate reconsideration
records or set legacy `reconsidered` fields to true to bypass an outdated client.
Coordinate mobile rollout; older apps can still disable resubmission locally.

The deprecated admin-only `action: "reconsider"` write is temporarily retained
because deployed-client usage is uncertain. It is not called by the current UI
or ordinary resubmission and can be retired after client compatibility is verified.
No schema/history deletion is planned. Merchant explanations must not contain
other applicants' private information or internal assessment notes.
