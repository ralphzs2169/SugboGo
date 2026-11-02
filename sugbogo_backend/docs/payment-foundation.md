# Merchant Plus payment foundation and mocked checkout

Task 2 added financial persistence and read-only paid-access lookup. Task 3A adds
Hosted Checkout v2 creation/resumption, exercised only with mocked provider HTTP.
Neither task marks payments paid, activates entitlements, accepts webhooks,
schedules payment tasks, sends payment notifications, or implements mobile UI.

Task 3A has not verified connectivity with PayMongo's real API because PayMongo account credentials are not currently available.

## Product and ownership

`apps/payments/constants.py` owns the immutable `merchant_plus` / `capstone-v1`
offer: Merchant Plus, 100 centavos, PHP, 30 days, one-time. Future activation must
start the purchased period at first successful fulfilment; this foundation does
not implement that activation. Provider fees must not increase the future total.

`PaymentService.create_or_get_payment` is an internal, credential-free local
reservation primitive. It accepts no price, product, mode, paid-state, or access
overrides. An optional business identifier is checked against server ownership.
The service locks Business before checking active paid access and unresolved
obligations. Repeated calls return the same unresolved record without updating
its snapshot. This does not create or permit gateway checkout while disabled.

Domain `purchase_eligible` is separate from `checkout_enabled`: a merchant can
qualify for a purchase while checkout remains unavailable. New purchases require
eligibility and enabled checkout; an unresolved unpaid purchase can instead be
resumed safely. Missing entitlement records on an otherwise fulfilled purchase
also remain unresolved, rather than prompting a second charge.

## Persistence and constraints

- `PAYMENT`: protected purchaser/business, immutable UUID and offer snapshot,
  financial pending/paid, independent not_started/pending/fulfilled/needs_attention
  fulfilment, safe provider identifiers, confirmation times, and recovery metadata.
- `PAYMENT_CHECKOUT_SESSION`: protected Payment, immutable operation reference,
  stored environment, provider observations, and the approved creation states.
- `PAYMONGO_WEBHOOK_EVENT`: unique environment/event identity, protected optional
  matches, scalar allowlisted JSON capped at 16 KiB, digest, and processing metadata.
- `PAID_MERCHANT_PLUS_ENTITLEMENT`: protected business and one-to-one Payment,
  start/expiry, and no duplicated environment field.

Database constraints enforce positive amounts/durations, PHP, valid state values,
paid evidence, paid-before-fulfilment, fulfilment timestamps, provider identity
uniqueness per mode, one unresolved purchase/open operation, and valid expiry.
Cross-table ownership and mode checks belong in services/model validation, not
SQL check constraints. Ordinary saves preserve payment snapshots and checkout
operation identity. Direct SQL and QuerySet.update bypass model save validation;
future processing must use the domain services rather than arbitrary updates.

No card credentials are stored. The only card-specific summary is brand/last4.
Gateway payloads and signatures must not be inserted into normalized event data.

## Access and status compatibility

Valid paid access requires current ownership, matching payment/business, product,
payment=paid, fulfilment=fulfilled, starts_at <= now < expires_at, and matching
PAYMONGO_MODE. Test grants never become live grants after configuration changes.
History retrieval uses each record's stored environment.

Paid sources are `paymongo_test` and `paymongo_live`. Without paid access, existing
preview/mock behavior is preserved. Demo activation/reset still operates only
demo rows. Enforced access with mock disabled never accepts a demo grant.

GET `/api/merchant/plus/status/` retains its existing envelope/fields and adds
product, payment_mode, checkout_enabled, paid references/dates, unresolved
references, and domain eligibility. Mock mutation responses retain their legacy
demo-only contract. The mobile change only widens the access-source type.

## Configuration and deployment

Configuration follows `.env` through Django settings. Checkout defaults off,
mode defaults test, methods default gcash, and credentials default empty.
Variables are documented in `.env.example`; no credentials are committed.

Enabled checkout requires enforcement=True, mock=False, active-mode API/signing
credentials, matching API key prefixes, a supported method allowlist, and an
HTTPS return URL without credentials/query/fragment. Configuration parsing never
prints key values. Live and test secrets are independent; the checkout adapter
selects credentials from the stored Payment mode, as must later processing.

Deploy the generated payment and merchant-analytics migrations before using the
updated access/status code. No existing demo records are converted or deleted.

## Checkout API (Task 3A)

POST `/api/merchant/plus/checkout/` requires an active Merchant JWT and an explicit
JSON `{}` body. Non-object JSON, omitted bodies, unsupported fields, query
parameters, and non-JSON submissions are rejected. Ownership, product, amount,
duration, environment, and return targets come from the server. Checkout must be
enabled, Plus enforced, and mock access disabled. A scoped 10/minute throttle
supplements the existing user throttle; it is not the duplicate safety mechanism.

Responses retain `success`, `message`, `data`. Safe data contains `payment_id`,
`payment_reference`, `product` (code/name), `amount_centavos`, `currency`, `mode`,
`payment_status`, `fulfilment_status`, `checkout_status`, `checkout_session_id`,
`checkout_url`, `next_action`, and `status_check_after_seconds`.

| HTTP | Meaning |
| --- | --- |
| 201 | A new provider session was saved as ready; next_action=open_checkout. |
| 200 | Existing ready checkout reused, including its exact tokenized URL. |
| 202 | Creating/creation_unknown; next_action=wait, URL/session=null, check after 5 seconds. |
| 409 | Paid access active, paid purchase awaiting fulfilment/review, changed ownership, or unsafe replacement. |
| 502 | Validated definite provider rejection; operation=creation_failed, Payment still pending. |
| 503 | Server configuration unavailable before transmission; operation=creation_failed. |

Standard permission, validation, authentication, not-found, and throttle responses
retain their existing DRF envelopes. A 502/503 does not automatically retry the
request. A later explicit request can reserve a new operation only after a
recorded definite rejection or proven pre-transmission configuration failure.

GET `/api/merchant/plus/status/` additionally exposes nullable
`unresolved_payment_status` and `unresolved_checkout_status` alongside the existing
owned unresolved ID/reference. This allows rediscovery after login/restart. It
does not expose the checkout URL, provider payload, or credentials. Authenticated
checkout POST resumes the existing ready session. No client redirect confirms
payment; this task provides no return endpoint or mobile route.

## Reservation, reuse, and uncertain outcomes

```text
Authenticate -> owned business -> enabled checkout / fixed product
  -> short transaction: Business lock -> Payment reuse/reservation + row lock
     -> active paid access/review? 409
     -> ready operation? return 200 with existing checkout
     -> creating/creation_unknown? return 202 without provider I/O
     -> otherwise reserve creating operation -> COMMIT
  -> one PayMongo POST outside database transaction
  -> short transaction: Business -> Payment -> operation locks
     -> validated success: ready -> 201
     -> validated rejection: creation_failed -> 502
     -> uncertain outcome: creation_unknown -> 202
Payment remains pending / fulfilment not_started; no entitlement is created.
```

The existing partial uniqueness constraints enforce one unresolved purchase per
business/product/mode and one creating/creation_unknown/ready operation per
Payment. Business locking serializes competing requests; the reservation commits
before network I/O. The view opts out of ATOMIC_REQUESTS so enabling that setting
later cannot silently hold the reservation open during provider I/O. Callers of
the domain orchestrator must likewise not wrap it in an outer transaction.

Ready sessions are reused regardless of elapsed local time or browser closure.
Expired/completed sessions are not replaced in this task. Replacement requires a
later authoritative recovery workflow. An older open operation takes precedence
over any historical failed operation.

Read/connect timeouts, connection interruptions (including TLS/stream failures),
malformed/oversized success, mismatched fields/mode, redirects, unrecognized 4xx,
408/409/429, and 5xx are **creation_unknown**. The Payment and immutable operation
reference remain. No automatic retry, deletion, invented provider ID, or new
operation is allowed. The 60-second lease is diagnostic only: an elapsed creating
lease becomes creation_unknown and never authorizes another provider POST. A
late valid response can still finalize that same operation. A process/database
failure after transmission leaves the committed operation blocking recreation.
No recovery worker or provider retrieval operation is implemented here; unknown
outcomes can remain blocked until later authoritative reconciliation/support.

Definite rejection requires HTTP 400/401/403/422, no `data` resource, and a nonempty
`errors` array in which **every** code is one of:
`parameter_invalid`, `parameter_data_type_invalid`, `parameter_format_invalid`,
`parameter_required`, `api_key_required`, `authentication_invalid`,
`api_key_not_found`, `secret_key_required`, `account_not_activated`.
No raw error detail is logged, persisted, or sent to the client. A configuration
failure detected before any HTTP transmission is separately recorded as
`configuration_unavailable`. Other responses remain uncertain conservatively.

Ownership and stored mode are rechecked before saving provider observations.
Changed ownership retains a successfully returned provider ID/URL internally
under creation_unknown but withholds it from the former owner. Provider identity
constraint conflicts also block recreation. Historical test Payments never select
live credentials merely because PAYMONGO_MODE changes.
Ownership-review and provider-identity-conflict cases return 409, retaining the
creation_unknown operation for investigation without issuing another POST.

## Concrete PayMongo adapter and official contract

`apps/shared/services/paymongo_service.py` owns only normalized checkout creation:
POST `https://api.paymongo.com/v2/checkout_sessions` using HTTP Basic authentication
(stored-mode secret as username, empty password), existing Requests, TLS
verification, 3.05-second connect / 10-second read timeout, no redirects and no
automatic POST retries. Decoded responses are bounded to 64 KiB. Provider raw
bodies, exceptions, authorization headers, and credentials are never logged or
returned. Only safe identifiers/status observations leave the adapter.

The payload uses `data.attributes`, one line item (name/amount/currency/quantity),
configured payment_method_types, description, reference_number, and metadata
containing public payment/operation UUIDs. `pass_on_fees=false` keeps fees with
SugboGo; `send_email_receipt=false` avoids an unimplemented provider receipt flow.
The price remains 100 PHP centavos with no surcharge.

Configured HTTPS PAYMONGO_RETURN_BASE_URL receives server-generated public
references and an outcome=success/cancel query hint. These are navigation hints
only. There is no handler or entitlement action attached to them in Task 3A;
the configured landing target must be provisioned/verified in later integration.
PayMongo's cancel_url means navigation away from checkout, not financial failure
or proof that the provider session is unusable.

Validation requires checkout_session resource, cs_ identifier, boolean livemode
matching the Payment, and an HTTPS URL on the documented exact
`checkout.paymongo.com` host. The entire returned URL, including token/fragment,
is stored unchanged. Additional echoed line items, reference, methods, return
URLs, fee policy, and status are checked if present. V2 defers Payment Intent
creation, so a missing/null payment_intent is valid; a present intent is safely
normalized. The official quick-start minimum omits several full-resource fields,
so these are not invented as mandatory creation-response fields. No undocumented
provider idempotency-header guarantee is assumed.

Official references inspected for this implementation:

- [Hosted Checkout overview and v2 request](https://docs.paymongo.com/docs/payment-channels-hosted-checkout)
- [V2 quick start and minimal response](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Checkout Session resource and cancellation/status fields](https://docs.paymongo.com/reference/checkout-session-resource)
- [Error envelope and handling](https://docs.paymongo.com/docs/developer-tools-error-handling)
- [Authentication and parameter error codes](https://docs.paymongo.com/docs/payment-acceptance-errors-pipm)

## Mocked-provider verification

Provider service tests replace Requests POST with bounded mock responses, including
success, validation/auth rejection, malformed responses, unsafe URLs, mode/amount
mismatches, read timeouts, connection/stream interruption, and oversize payloads.
API tests cover ownership/input/auth/configuration, fixed snapshots, reuse,
uncertainty, expired leases, status rediscovery, and environment isolation.
PostgreSQL TransactionTestCase races real concurrent API requests while holding
mocked provider I/O open, verifies reservation commit before I/O, and asserts one
provider POST/Payment/open operation for success and timeout. No PayMongo account
or real provider key is used. Test database names are unique and disposable.

Task 3B must validate real test-mode connectivity, account capabilities, actual
method minimum amounts (including whether the approved PHP 1 offer is accepted),
and returned checkout domains/response observations. Mock tests cannot establish
these facts and never change the approved price to bypass provider restrictions.

## Task 3A validation record

All provider HTTP was mocked. These commands ran from `sugbogo_backend` using the
existing virtual environment. The PostgreSQL wrapper selects a fresh disposable
test database so it cannot reuse/delete an existing project's test database.

Initial provider-only run: 13 passed.

```powershell
& '.\.venv\Scripts\python.exe' -B manage.py test apps.shared.tests.test_paymongo_service --noinput --verbosity=1
```

The first API run exposed three non-object JSON validation errors. They were
corrected to return controlled DRF validation responses. Subsequent focused
provider/API/concurrency runs passed 43 tests, then 46 after adding ownership,
product-snapshot, and provider-identity-conflict coverage.

Final focused command: 46 passed, zero failures/errors, including two PostgreSQL
concurrency races (success and uncertain provider creation).

```powershell
& '.\.venv\Scripts\python.exe' -B -c "import os, uuid; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); import django; django.setup(); from django.db import connections; connections['default'].settings_dict['TEST']['NAME'] = 'test_sugbogo_payments_' + uuid.uuid4().hex[:10]; from django.core.management import execute_from_command_line; execute_from_command_line(['manage.py', 'test', 'apps.shared.tests.test_paymongo_service', 'apps.merchant_operations.merchant_analytics.views.tests.test_plus_checkout_views', 'apps.payments.services.tests.test_checkout_concurrency', '--noinput', '--verbosity=1'])"
```

Compatibility command: 118 passed, zero failures/errors. This includes existing
Task 2 models/constraints, paid access/status, configuration, preview/mock access,
and existing concurrency tests. The final focused run above additionally covers
the last three edge-case tests and final checkout hardening.

```powershell
& '.\.venv\Scripts\python.exe' -B -c "import os, uuid; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); import django; django.setup(); from django.db import connections; connections['default'].settings_dict['TEST']['NAME'] = 'test_sugbogo_payments_' + uuid.uuid4().hex[:10]; from django.core.management import execute_from_command_line; execute_from_command_line(['manage.py', 'test', 'apps.shared.tests.test_paymongo_service', 'apps.payments.services.tests', 'apps.merchant_operations.merchant_analytics.views.tests.test_plus_checkout_views', 'apps.merchant_operations.merchant_analytics.views.tests.test_paid_plus_status_views', 'apps.merchant_operations.merchant_analytics.views.tests.test_plus_permission', 'apps.merchant_operations.merchant_analytics.views.tests.test_mock_plus_views', 'apps.merchant_operations.merchant_analytics.services.tests.test_mock_plus_service', 'apps.merchant_operations.merchant_analytics.services.tests.test_mock_plus_settings', 'apps.merchant_operations.merchant_analytics.services.tests.test_mock_plus_concurrency', '--noinput', '--verbosity=1'])"
```

Additional checks: no Django issues, no migration drift, and no whitespace errors.
No model or migration changes are required by Task 3A.

```powershell
& '.\.venv\Scripts\python.exe' -B manage.py check
& '.\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
git diff --check
```

Next: Task 3B — verify real PayMongo test API connectivity and create one real
test-mode Hosted Checkout Session once PayMongo credentials become available.
