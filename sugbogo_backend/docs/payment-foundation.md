# Merchant Plus payment foundation

Task 2 adds local financial persistence and read-only paid-access lookup. It does
not contact PayMongo, reserve checkout operations, mark payments paid, activate
entitlements, accept webhooks, schedule tasks, send notifications, or expose new
payment mutation endpoints. The existing Plus status endpoint is extended.

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
qualify for a purchase while checkout remains unavailable. Future checkout must
require both. Missing entitlement records on an otherwise fulfilled purchase
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
prints key values. Live and test secrets are independent; historical processing
must select credentials from the stored record mode in later tasks.

Deploy the generated payment and merchant-analytics migrations before using the
updated access/status code. No existing demo records are converted or deleted.

Next: Task 3 — PayMongo Hosted Checkout creation and safe duplicate-checkout handling.
