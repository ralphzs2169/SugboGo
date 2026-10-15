# Merchant Plus simulation API

This task adds persistent demo-only access to the existing merchant analytics app. It implements no payment processor, pricing plan, card/bank collection, billing, renewal, receipt, refund, subscription expiry or real paid entitlement. API responses explicitly identify the simulation. Premium does not change business approval, verification, listing status, Featured placement or scoring.

## Configuration and gate behavior

Both flags accept explicit True/False strings (case-insensitive, surrounding whitespace ignored). Invalid strings fail startup. Defaults remain False. Configure only server-side; clients cannot override flags.

| MERCHANT_PLUS_ENFORCED | MERCHANT_PLUS_MOCK_ENABLED | Effective Premium access | Mock mutation APIs |
|---|---|---|---|
| False | False | Existing preview after normal auth/role/ownership checks | Disabled |
| False | True | Existing preview regardless of stored grant | Enabled; stored state still changes |
| True | False | Denied; no real paid lookup exists and mock rows are ignored | Disabled |
| True | True | Allowed only with an active owned-business demo grant | Enabled |

For a deny/upgrade/reset demonstration, use enforcement True and mock True. Enforcement-off preview cannot demonstrate locking even after resetting a grant. Keep mock mode False outside explicit demonstrations; for an enforced deployment use enforcement True as well. DEBUG does not control mock mode. Enabling mock mode intentionally permits active merchant owners to grant themselves simulation access; this API must not be reused as payment verification.

`merchant_has_plus_access(user)` remains the Premium permission integration point. With enforcement and mock mode on, it checks only the caller's owned-business active demo record. With mock mode off it does not query demo grants and fails closed until a separate real entitlement implementation exists. All seven Premium analytics endpoints retain IsAuthenticated, HasRole(merchant), HasMerchantPlus and server-side ownership.

## Routes and input

| Route | Input | Result |
|---|---|---|
| GET /api/merchant/plus/status/ | No query parameters | Stored demo state and effective access; read-only |
| POST /api/merchant/plus/mock-activation/ | JSON `{ "outcome": "success" }`, or failure/cancelled | Process the simulated outcome; only success grants |
| POST /api/merchant/plus/mock-reset/ | Empty JSON `{}`; no query parameters | Revoke owned demo grant idempotently |

All routes require an authenticated active merchant with an owned business. Admin/superadmin/explorer/inactive accounts are rejected. These routes deliberately do not require HasMerchantPlus: a Standard merchant must be able to inspect status and activate the demo. Enabled routes return the existing 404 when ownership is missing. An owned suspended listing remains readable and eligible for demo activation under the agreed owner-access policy; its listing status/verification are not changed.

Unknown parameters, including business_id, user_id, plan, amount, card_number, has_plus_access and mock_enabled, return the normal 400 validation envelope. Activation requires a supported outcome. Reset accepts no body fields. Disabled mutations return 403 `MOCK_PLUS_DISABLED` before ownership queries; normal authentication/role checks still run first. Status remains available regardless of mock mode, after the migration is deployed.

All responses retain core success/error envelopes. Simulated failure/cancellation returns HTTP 200 / success:true because the simulation request was processed; **this does not mean activation succeeded**. Clients must read `data.outcome`, `data.changed` and `data.status`. No provider/financial transaction is initiated.

### Status payload

```text
data:
  business: {id, name, status}  # caller's owned business only
  stored_demo_state: not_created | inactive | active
  effective_tier: standard | plus
  has_plus_access: boolean
  access_source: none | preview | mock
  enforcement_enabled: boolean
  mock_enabled: boolean
  is_simulation: true
  activated_at: ISO datetime or null
  reset_at: ISO datetime or null
  updated_at: ISO datetime or null
```

Stored state remains visible even when mock grants are disabled and have no effect. `plus` with access_source preview means the preview bypass, not a purchased plan. An inactive grant can therefore coexist with preview access. GET never creates, updates, or refreshes a row.

Mutation payload: `data = { outcome, changed, status }`, where status uses the contract above and outcome is success/failure/cancelled/reset.

## Persistence, idempotency and concurrency

`DemoMerchantPlusEntitlement` is an approved new model in the existing merchant_analytics app. Table `DEMO_MERCHANT_PLUS_ENTITLEMENT` has one OneToOne BUSN_ID row per business, active flag, activation/reset timestamps and created/updated timestamps. It contains no price, payment details, user-supplied transaction proof or real subscription fields. Deleting the business cascades this demo record. The grant follows the owned business; no business-transfer workflow is implemented here, and future transfer policy must decide how demo grants are handled.

The database requires an activation timestamp for active rows. An initial success creates an active row. Repeated success while active returns changed:false and preserves timestamps. Failure/cancellation creates no row and leaves an existing active/inactive row untouched. Reset of absent/inactive state returns changed:false without creating a row; active reset records the reset time. Reactivation reuses the row, records a new activation time and retains the latest historical reset timestamp. Timestamps describe the latest transitions, not a full attempt/audit ledger.

Mutations are atomic and lock the owned Business row before inspecting the grant, including first activation when no grant row exists. This serializes concurrent activation/reset. The OneToOne database constraint additionally prevents duplicate grants. Service/view tests cover state and ownership, plus PostgreSQL threaded tests for duplicate activation and duplicate reset. Requests for different businesses do not share that row lock.

## Migration and rollout

`merchant_analytics/0001_initial` creates the single new model and depends on `business/0028_rename_vouch_installation_id`. No migration alters existing business/user/review/analytics fields or backfills grants. The app was already registered; no new app or dependency is added. The earlier model-free description no longer applies to this app.

Generation of the file is separate from applying it. Before application-database changes, inspect the full plan, including dependencies:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py migrate merchant_analytics --plan
```

Only after the database owner approves that plan, apply the scoped migration:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py migrate merchant_analytics
```

Dependencies can require additional pending migrations; do not describe this command as guaranteed to affect only one table without inspecting the plan. Broad application migration, local .env changes, and production activation are not authorized by migration-file generation. Rollback would remove demo data, so review/recover needed records before reverting the schema. Do not catch a missing table as a fabricated Standard status: rollout must deploy the migration before these APIs are used.

## Frontend demonstration

1. After approved migration deployment, configure enforcement True and mock True and restart the backend.
2. Authenticate merchant A. Read status and confirm source none/no access before activation.
3. Request a Premium endpoint: expect 403 PLUS_REQUIRED; Standard remains accessible.
4. POST failure/cancelled: no access or persisted state change. Show the simulated outcome explicitly.
5. POST success: display 'Demo Premium activated - no payment collected'. Refetch status and the desired Premium endpoint.
6. Confirm merchant B remains denied and cannot select A's business.
7. Repeat success: changed:false, no duplicate grant or refreshed activation timestamp.
8. POST reset and refetch status: Premium denied again under enforcement, Standard still accessible.
9. Turn mock mode off and restart: saved demo grants confer no enforced access. Do not represent them as paid subscribers.

No frontend upgrade UI is implemented in this backend branch. Real JWT/network requests, app restart persistence, application migration deployment and frontend transitions remain manual integration checks until recorded.

## Automated verification

From sugbogo_backend, with approval to create/migrate/remove a disposable PostgreSQL/PostGIS test database:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.business.services.tests.test_visibility_analytics_service apps.shared.analytics apps.admin_operations.analytics --noinput
```

Also run Django system checks and `makemigrations merchant_analytics --check --dry-run` to detect schema drift. Tests use mocked visibility reads; PostgreSQL concurrency tests use real row locking in the test database. Do not present these as live Mongo, payment, frontend or production verification.

### Recorded verification: 14 October 2026

- All 253 tests in the command above passed, including 27 new mock-entitlement tests and both PostgreSQL concurrent activation/reset tests; no skips were reported.
- Django system checks passed and no merchant_analytics migration drift was detected.
- The generated migration was applied successfully in the disposable test database; that database was removed after the run.
- Simulated Mongo outage/cursor failures produced expected log traces, not test failures.
- Application-database migration, local .env changes, live JWT/network demonstration, frontend integration and live Mongo verification were not performed by this run.
