/** Server instructions for one fixed-product purchase operation. */
export type MerchantPlusCheckout = {
  payment_id: number;
  payment_reference: string;
  provider: "maya" | "paymongo";
  mode: "test" | "live";
  amount_centavos: number;
  currency: string;
  payment_status: "pending" | "paid";
  fulfilment_status: string;
  checkout_status: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  next_action: "open_checkout" | "wait";
  status_check_after_seconds: number | null;
};
