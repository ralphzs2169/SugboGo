/** Synthetic records exercise the public inspection contract without provider credentials. */
export function paymentFixture(id = 1, overrides = {}) {
  return {
    id,
    reference: `9b56c5b3-96a3-4db8-9a68-${String(id).padStart(12, "0")}`,
    merchant: {
      id: 10 + id,
      name:
        id === 3
          ? "Maria Angela Catalina Victoria Dela Cruz Villanueva"
          : "Ana Dela Cruz",
      email: `merchant${id}@example.test`,
    },
    business: {
      id: 20 + id,
      name: "Cebu Heritage Kitchen and Specialty Coffee",
    },
    provider: id === 2 ? "paymongo" : "maya",
    mode: "test",
    amount_centavos: 100,
    currency: "PHP",
    financial_status: id === 1 ? "pending" : "paid",
    fulfilment_status:
      id === 1 ? "not_started" : id === 2 ? "pending" : "fulfilled",
    checkout_state: id === 1 ? "creation_unknown" : "completed",
    checkout_outcome: id === 1 ? "unknown" : null,
    needs_review: id === 1,
    created_at: "2026-11-15T04:00:00Z",
    ...overrides,
  };
}

export const summaryFixture = {
  total_payments: 32,
  pending: 12,
  paid: 20,
  needs_review: 3,
};

export function listFixture(
  params = {},
  rows = [paymentFixture(1), paymentFixture(2), paymentFixture(3)],
) {
  return {
    items: rows,
    pagination: {
      page: params.page || 1,
      page_size: params.page_size || 10,
      total_items: 32,
      total_pages: Math.ceil(32 / (params.page_size || 10)),
      has_next: (params.page || 1) < 4,
      has_previous: (params.page || 1) > 1,
    },
  };
}

export function detailFixture(id = 1) {
  const row = paymentFixture(id);
  return {
    ...row,
    product: "merchant_plus",
    product_version: "capstone-v1",
    access_duration_days: 30,
    paid_at: id === 1 ? null : "2026-11-15T04:01:00Z",
    verified_at: id === 1 ? null : "2026-11-15T04:02:00Z",
    fulfilled_at: id === 3 ? "2026-11-15T04:03:00Z" : null,
    checkouts: [
      {
        id: 40 + id,
        operation_reference: row.reference,
        provider: row.provider,
        mode: row.mode,
        state: row.checkout_state,
        outcome: row.checkout_outcome,
        provider_session_id: `provider-checkout-${id}`,
        provider_status: id === 1 ? "" : "PAYMENT_SUCCESS",
        created_at: row.created_at,
        updated_at: "2026-11-15T04:01:00Z",
        checked_at: id === 1 ? null : "2026-11-15T04:02:00Z",
        lease_until: null,
      },
    ],
    verification: {
      verified: id !== 1,
      provider_payment_id: id === 1 ? null : `provider-payment-${id}`,
      amount_centavos: id === 1 ? null : 100,
      currency: id === 1 ? null : "PHP",
      request_reference: id === 1 ? null : row.reference,
      verified_at: id === 1 ? null : "2026-11-15T04:02:00Z",
      payment_method: id === 1 ? null : "card",
      card_brand: id === 1 ? null : "visa",
    },
    entitlement:
      id === 3
        ? {
            id: 80,
            access_source: "maya_test",
            starts_at: "2026-11-15T04:03:00Z",
            expires_at: "2026-12-15T04:03:00Z",
            active_in_stored_mode: true,
          }
        : null,
    events: [
      {
        id: 100 + id,
        type: id === 2 ? "checkout_session.payment.paid" : "PAYMENT_SUCCESS",
        provider: row.provider,
        mode: row.mode,
        state: id === 1 ? "needs_attention" : "processed",
        needs_review: id === 1,
        has_conflict: id === 1,
        attempts: 1,
        provider_created_at: null,
        received_at: "2026-11-15T04:01:00Z",
        processed_at: id === 1 ? null : "2026-11-15T04:02:00Z",
        retry_at: null,
        lease_until: null,
      },
    ],
  };
}
