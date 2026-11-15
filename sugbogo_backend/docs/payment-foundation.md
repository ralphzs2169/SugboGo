# Merchant Plus payment foundation

## M6 prerequisite — checkout outcome and return navigation

The Plus status response includes nullable `checkout_outcome`, derived from the
unresolved checkout's stored evidence. Maya PAYMENT_CANCELLED, PAYMENT_FAILED
and PAYMENT_EXPIRED map to cancelled, failed and expired. Stored local expired
also maps to expired. Creating/ready with an absent or known initial pending
observation maps to pending. Other evidence, including creation_unknown, maps
to unknown. Paid purchases and absence of an unresolved purchase return null.
Financial status, fulfilment and has_plus_access remain separate authoritative fields.

Configure `MAYA_RETURN_BASE_URL` as the deployed public web application's full
HTTPS URL ending in `/merchant-plus/return`. The existing backend builder adds
distinct outcome=success, outcome=failure or outcome=cancel plus local references.
The public page forwards only one recognized outcome to
`sugbogo://merchant-plus/return` through an explicit Open SugboGo link.
Invalid, duplicate or missing outcomes produce a link without a hint. Other
parameters, including references and arbitrary redirect destinations, are dropped.

The public route bypasses Admin session restoration. The mobile route uses the
existing merchant authentication/role guard and refreshes GET Plus status on focus.
It makes no checkout POST. Its placeholder Continue to Analytics action preserves
the existing merchant navigation. No purchase or financial mutation is attached to
either return route. Full return presentation and polling are deferred to M6.

Deploy the updated web build with SPA fallback for this public path, and install
the updated mobile build containing the route. Existing sugbogo custom-scheme
registration is reused. No domain association or native configuration change is
required for the explicit custom-scheme link. Opening the installed app from the
deployed bridge still needs physical-device acceptance testing.

## M5 — paid Merchant Plus fulfilment

M4 verifies Maya evidence and commits a financially paid Payment with fulfilment
pending. It then dispatches `apps.payments.tasks.fulfil_merchant_plus_payment`
after commit. M5 uses that stored verification evidence to activate access.

The fulfilment service locks Business then Payment, matching checkout and
confirmation lock order. It validates the owner, supported provider/environment,
Merchant Plus version, 100 centavos PHP, 30-day duration, payment ID and verification
timestamps. Unsupported or conflicting paid obligations require review.

Entitlement creation and fulfilment completion share one database transaction.
The existing one-to-one Payment relationship enforces at most one grant.
Access starts at the first successful fulfilment time and expires exactly 30 days
later. A duplicate invocation returns the same grant with its original timestamps.
An existing valid grant on an unfinished Payment is reused, including an expired
grant. An overlapping grant in the same environment requires review without stacking.

The financial state stays paid. Successful fulfilment sets fulfilment fulfilled and
records the original access start in `PYMT_FULFILLED_AT`. Existing access and status
queries derive `maya_test` or historical PayMongo sources from the associated
Payment, with test/live isolation. Maya Production fulfilment is unsupported.

No external HTTP runs inside fulfilment. The transaction locks serve as the claim,
so interruption before commit rolls back both grant creation and completion.
Celery Beat runs `recover_merchant_plus_fulfilment` every 30 seconds, redispatching
up to 100 eligible unfinished paid Payments. Existing future retry times and leases
are respected. Broker loss and worker interruption leave the Payment recoverable.
Invalid records and fulfilled Payments are excluded from automatic recovery.

After activation commits, the existing notification service creates a persistent
`merchant_plus_activated` notification deduplicated by recipient and Payment.
Notification failure is logged safely and activation stays committed. Notification
delivery is best effort and has no separate recovery worker in M5.

## M4 — Maya Sandbox webhook and payment confirmation

Enable `MAYA_WEBHOOK_ENABLED=True` only on a Sandbox deployment configured
with `PAYMENT_PROVIDER=maya` and `PAYMENT_MODE=test`. Supply
`MAYA_SANDBOX_SECRET_KEY` and both published RSA verification PEMs in
`MAYA_SANDBOX_WEBHOOK_VERIFICATION_KEY_1` and
`MAYA_SANDBOX_WEBHOOK_VERIFICATION_KEY_2`. Multiline PEMs and literal
`\n` separators are supported. These keys are separate from the Checkout API
keys. The webhook switch is independent of the switch for creating checkouts.

Register the exact public HTTPS path `/api/payments/webhooks/maya/test/` for
`PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_EXPIRED`, and
`PAYMENT_CANCELLED` on a dedicated Sandbox account. The route accepts only
JSON POSTs up to 64 KiB and authenticates Maya through its millisecond
timestamp and RSA-SHA256 signature. The timestamp has an inclusive five-minute
tolerance in either direction. The signature covers Maya's sorted flattened
JSON entries and nonce. Both public keys are tried for rotation. IP
allowlisting can be configured at a trusted edge where the actual origin is
known. Django does not use client-supplied forwarded headers to authenticate
the sender. [Maya webhook security](https://developers.maya.ph/reference/webhook-security)

A verified delivery is committed to `PaymentProviderEvent` before HTTP 200.
Deduplication uses provider, mode, payment UUID and event status. The inbox
keeps a SHA-256 digest and the normalized reconciliation fields. A conflicting
duplicate flags the original row for review, and unsupported signed statuses
are recorded as ignored. The callback publishes after commit with broker
retries disabled. Celery Beat recovers due and abandoned rows every 30
seconds. The worker claims a 90-second lease, performs provider HTTP outside
the transaction, and checks the attempt before writing. Transient failures use
bounded backoff and eventually require review. Maya retries failed deliveries
up to three times, after 5, 15, and 45 minutes from the preceding attempt.
[Maya webhook delivery](https://developers.maya.ph/reference/configuring-your-webhook-for-maya-checkout)

The worker uses the secret-key Retrieve Payment by ID endpoint and checks the
persisted Maya Sandbox checkout UUID, operation reference, owner and business,
product snapshot, currency and exact amount of 100 centavos PHP. A matching
`PAYMENT_SUCCESS` can mark the Payment `paid` and fulfilment `pending`. It
records provider payment and verification times, using the provider's update
time when a successful payment lacks a distinct payment timestamp. It
completes the local checkout. Verified unsuccessful events update checkout
observations and never change a paid Payment. A verified expiry also marks
the checkout expired. Financial confirmation dispatches M5 fulfilment after commit.
[Maya Retrieve Payment by ID](https://developers.maya.ph/reference/getpaymentviapaymentid-1)

Only shared published Sandbox credentials were available for the integration
check. Retrieve Payment returned HTTP 200 for the existing M3 checkout. Its
payment UUID, operation reference and 100 centavos PHP matched the local
record. Maya reported `PENDING_TOKEN`. The local Payment stayed `pending`,
with zero linked events and zero entitlements. Shared webhook subscriptions
were left untouched, so real signed delivery and successful-payment
confirmation remain unverified. Use a dedicated Sandbox merchant, stable
public HTTPS endpoint, and running Celery worker and Beat to test real delivery.

## M3 — Maya Sandbox Create Checkout

The active gateway for `PAYMENT_PROVIDER=maya` and `PAYMENT_MODE=test` is Maya
Sandbox. For controlled testing, enable `MAYA_CHECKOUT_ENABLED`, enforce Plus,
disable mock grants, and supply the Sandbox keys and HTTPS return base through the
local ignored environment. The Create Checkout request uses the Sandbox public
API key as the HTTP Basic username with a blank password. The secret key is
part of the M2 configuration but is unused by Create Checkout. The PayMongo
adapter and historical payment reads remain available.

`POST /api/merchant/plus/checkout/` accepts an authenticated Merchant's empty
JSON object. SugboGo checks ownership and eligibility, locks the Business and
Payment, then commits one open checkout operation before sending a single
`POST https://pg-sandbox.paymaya.com/checkout/v1/checkouts`. The request maps:

- The server snapshot's 100 centavos to the JSON number `1.00` in PHP using
  `Decimal`, with one Merchant Plus item of quantity 1 and matching unit and
  total amounts.
- The local checkout operation UUID to `requestReferenceNumber`.
- Server-generated HTTPS `success`, `failure`, and `cancel` URLs to
  `redirectUrl`. They carry the public payment and operation references and an
  outcome hint for navigation. The payload omits optional Basic Buyer fields.

Maya documents a `200` response containing `checkoutId` and `redirectUrl`.
SugboGo validates the checkout UUID and accepts the exact HTTPS Sandbox origins
`payments-web-sandbox.paymaya.com` and `payments-web-sandbox.maya.ph`. It
persists Maya's URL intact on the `maya/test` operation. The operation is
`ready` and the Payment remains
`pending` with fulfilment `not_started`. An optional provider status is stored
only if supplied. All PayMongo intent fields remain null. Payment confirmation
is not implemented yet, and checkout creation does not create an entitlement.
[Maya Create Checkout](https://developers.maya.ph/reference/createv1checkout) ·
[Maya one-time Checkout](https://developers.maya.ph/reference/accept-one-time-payment-using-maya-checkout) ·
[Maya environments](https://developers.maya.ph/reference/api-environments)

The endpoint returns `201` for a new usable checkout, `200` to reuse the
same checkout, and `202` while waiting for a creation result or reconciliation.
The ownership and open-operation constraints used by concurrent requests also
hold across repeated calls. When a ready checkout reaches Maya's one-hour
lifetime, SugboGo withholds its hosted URL and keeps the operation for later
reconciliation. Local elapsed time alone cannot authorize replacement. The
general Plus status endpoint exposes the owner's pending references and states
without the hosted URL.

Outbound HTTP uses verified TLS, 3.05-second connect and 10-second read
timeouts, a 64 KiB response limit, and disabled redirects. Only recognizable
pre-creation Maya validation or authentication errors are classified as
definite rejections. Ambiguous responses and transport failures leave
`creation_unknown`. An interrupted worker's elapsed creation lease moves the
same operation to `creation_unknown`. The reservation and operation reference
survive, and requests make no additional provider POST until the outcome can
be reconciled. [Maya online payment errors](https://developers.maya.ph/reference/payment-errors) ·
[Maya authentication errors](https://developers.maya.ph/reference/authentication-and-api-key-error)

### Real Sandbox smoke test

On November 15, 2026, an authenticated request through the SugboGo checkout
endpoint sent one Create Checkout POST to Maya Sandbox using the published
Checkout credentials and a synthetic local merchant. The request sent numeric
`1.00` PHP, one Merchant Plus item, and omitted buyer information. The transport
received HTTP `200`, but the response did not yield a validated checkout ID
and hosted URL. SugboGo returned `202` and kept the operation in
`creation_unknown`. The Payment remained `pending` with fulfilment
`not_started` and zero paid entitlements. The hosted page could not be opened
from verified evidence. The attempt recorded a generic outcome code, so the
reason the response could not be used was not determined at that point.

One follow-up Create Checkout POST used a separate synthetic merchant and
operation UUID. Maya returned HTTP `200` and an `application/json` object
containing only `checkoutId` and `redirectUrl`. The ID was a canonical UUID.
The initial validator rejected the exact HTTPS hostname
`payments-web-sandbox.maya.ph`. Maya's published domain table lists the
`paymaya.com` hostname. The live Sandbox API returned the `maya.ph` hostname,
and both hostnames resolved to the same addresses and passed hostname-specific
TLS verification. SugboGo now accepts both exact origins. The captured
response was revalidated locally and persisted on the follow-up operation
without another Create Checkout POST. The operation became `ready`, the
Payment remained `pending`, and the paid entitlement count stayed at zero.
The first operation stayed in `creation_unknown` without changes. The hosted
page returned HTTP `200` in Chromium and displayed a checkout for ₱1.00. The
item name was absent from the rendered text. No payment was submitted.
[Maya domain table](https://developers.maya.ph/docs/domains-and-ip-addresses)

## M2 — Provider provenance and Maya Sandbox configuration

M2 does not yet call Maya Checkout.

Merchant Plus is a fixed server-priced purchase of ₱1.00 (100 centavos), in PHP,
for one 30-day period without renewal. Payment represents the local financial
obligation. Checkout operations track creation separately from payment
confirmation. Paid Plus access requires a verified paid Payment and its
fulfilled entitlement in the current environment.

### Persistence and upgrade

- `Payment.PYMT_PROVIDER`, `PaymentCheckoutSession.PCHK_PROVIDER` and
  `PaymentProviderEvent.PWEV_PROVIDER` identify the provider. The two forward
  migrations after `payments/0001` backfill historical rows to `paymongo`, copy
  the parent provider to each checkout, require the new fields, and rename the
  event table and columns in place. Existing primary keys and entitlement
  relationships are preserved.
- Checkout and Payment provider and environment are immutable on model saves.
  A checkout must agree with its parent. Provider payment and checkout IDs are
  unique within a provider and mode. One unresolved purchase remains enforced
  per business, product and mode, and one open checkout per payment. An existing
  same-mode PayMongo purchase stays unresolved across a provider switch.
- Paid payments require a provider payment ID and paid/verified timestamps.
  The nullable `PYMT_PROVIDER_INTENT_ID`, `PCHK_INTENT_ID` and
  `PCHK_INTENT_STATUS` are deprecated PayMongo-only evidence. PayMongo paid
  rows retain the existing intent requirement. Maya rows leave all three
  intent fields null. Checkout operation states and `creation_unknown` are
  preserved. Provider-confirmed terminal handling belongs to later work.
- `PAYMENT_PROVIDER_EVENT` uses provider, mode and dedupe key as its identity.
  Existing PayMongo event IDs become dedupe keys, and normalized PayMongo
  evidence remains readable. The checkout ID has its own column, and a
  separate payment ID can be carried as normalized `payment_id` evidence.
  Future Maya intake will choose a stable key
  based on verified payment identity and event type. Delivery timestamps and
  payload digests are separate from deduplication. The inbox retains the first
  normalized evidence and surfaces a conflicting duplicate for reconciliation.
  Store only bounded, allowlisted scalar evidence and a digest. Keep credentials,
  signature headers, raw card details, buyer data and unrestricted payloads
  out of the inbox. Provider-created time is optional.

Quiesce old payment writers before upgrading the database. Set the intended
`PAYMENT_MODE` explicitly on deployments that previously used
`PAYMONGO_MODE`. Checkout reservations and paid access use the current mode,
while owned historical payment reads use each stored row's provider and mode.
Stored `paymongo_test` and `paymongo_live` access sources remain readable.
Future verified Sandbox access will report `maya_test`. Changing the configured
provider alone grants no access. The owner-only Plus status shows the unresolved
payment's references, provider, mode, financial state, fulfilment state and
checkout state without returning provider credentials or payloads.

### Settings introduced in M2

| Setting | Purpose |
| --- | --- |
| `PAYMENT_PROVIDER` | Defaults to `maya`. The legacy `paymongo` value supports an explicitly configured historical environment without activating its gateway. |
| `PAYMENT_MODE` | Defaults to `test`. Supports `test` and `live` for application environment isolation. Maya is available only with `test`. |
| `MAYA_CHECKOUT_ENABLED` | Defaults to `False`. In M3, `True` enables Sandbox checkout with valid settings, Plus enforcement, and mock grants disabled. |
| `MAYA_SANDBOX_PUBLIC_KEY` / `MAYA_SANDBOX_SECRET_KEY` | API authentication keys. Use the ignored local `.env` or deployment environment configuration. Repository examples are empty and automated tests use synthetic values. |
| `MAYA_RETURN_BASE_URL` | Server-owned HTTPS return base, without user information, query or fragment. Configure it before enabling Maya settings. |

The Sandbox API host is fixed in backend code at
`https://pg-sandbox.paymaya.com`. The old `PAYMONGO_*` environment variables
are retired from Django startup. The PayMongo adapter, configuration parser and
mocked contract tests remain in the tree. No Maya production settings are used.

M4 adds separate RSA webhook verification key settings and verifies
`X-Maya-Webhook-Timestamp` and `X-Maya-Webhook-Signature` before recording
events, as described above.

## Historical Task 2 and Task 3A implementation

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

The Maya Sandbox migration superseded the planned PayMongo connectivity check.

## M7 — Admin read-only payment inspection

The Admin Web Payments directory (`/admin-panel/payments`) exposes stored Merchant
Plus payment history through active Admin / Super Admin permissions:

- `GET /api/admin/payments/` — standard server-paginated directory.
- `GET /api/admin/payments/summary/` — global counts, independent of list filters.
- `GET /api/admin/payments/<id>/` — safe, read-only inspection snapshot.

Directory criteria: `search`, `financial_status`, `fulfilment_status`, `provider`,
`mode`, `checkout_outcome`, `needs_review`, `start_date`, `end_date`, `ordering`,
`page`, and `page_size`. Search covers public reference, purchaser name/email,
business name, and provider payment ID. Creation dates are inclusive Philippine
calendar dates. Ordering accepts `newest`, `oldest`, `amount_highest`, and
`amount_lowest`, with stable ID tie-breakers. Pagination defaults to 10 and caps
page size at 100.

Global counts include both Test and Live history, regardless of the configured
active provider/mode. Needs Review counts distinct purchases with stored
fulfilment `needs_attention`, any `creation_unknown` checkout, or a provider event
in `needs_attention`. It overlaps Pending and Paid; it is a projection, not a new
financial state. Unlinked events are correlated only through stored checkout IDs
within the same provider and mode. Event history is oldest-received first.

The drawer separates financial verification from fulfilment and entitlement
activation. Entitlement activity is labelled in its stored environment; Test
activity never represents live revenue. It displays all stored checkout operations
and safe event metadata. Verification references require a matching completed
checkout; unavailable legacy evidence remains unavailable. Checkout lease timing
is not represented as provider expiry. No inspection request contacts Maya.

Only allowlisted fields leave the API. Hosted checkout URLs, normalized/raw event
payloads, digests, dedupe keys, API credentials, signatures, card digits, and legacy
intent IDs are withheld. Conflict indicators derive from stored controlled error
codes without returning the underlying error strings.

The API permits GET, HEAD, and OPTIONS only. The Web service has GET operations
only and no financial or entitlement action controls. No schema migration,
payment mutation, fulfilment dispatch, provider retry, or entitlement creation is
part of M7.

## Maya reconciliation fallback

Merchants can request independent verification through
`POST /api/merchant/plus/payment/reconcile/` with an empty JSON object.
The endpoint resolves the current owned Merchant Plus purchase in Maya test mode.
It retrieves the payment using the persisted checkout ID and the backend secret
key, outside database locks. Purchases without a known provider identity remain
unresolved.

Webhook processing and reconciliation share the same purchase evidence checks,
paid transition, and checkout observation functions. Under business, payment,
and checkout locks, reconciliation rechecks ownership, provider, environment,
product/version/duration, the exact PHP 100-centavo amount, checkout identity,
and operation request reference. PAYMENT_SUCCESS also requires a provider paid
timestamp. The transition dispatches the existing fulfilment task after commit.
Repeated requests for paid or active purchases perform no additional transition.
Existing fulfilment recovery handles missed broker dispatch.

The mobile payment-status screen reconciles once per explicit check or return
session, then performs bounded database-status polling. Return outcomes remain
navigation hints. Temporary provider failures are recoverable, and pending
provider observations preserve the unresolved purchase. Expired, failed, and
cancelled checkouts are never replaced through this endpoint.

Real signed webhook delivery and public HTTPS return-bridge reachability still
require deployment-specific acceptance. This fallback needs the existing Celery
fulfilment worker and recovery schedule to activate paid access.
