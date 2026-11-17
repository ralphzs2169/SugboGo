import apiClient from "@/shared/api/apiClient.service";
import {
  createMerchantPlusCheckout,
  reconcileMerchantPlusPayment,
} from "../merchantPlusCheckout.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

it("sends no client payment evidence to reconciliation", async () => {
  jest
    .mocked(apiClient.post)
    .mockResolvedValue({ data: { success: true, data: {} } });
  const controller = new AbortController();
  await reconcileMerchantPlusPayment(controller.signal);
  expect(apiClient.post).toHaveBeenCalledWith(
    "/merchant/plus/payment/reconcile/",
    {},
    { signal: controller.signal },
  );
});

it("posts only an empty object to the server-owned checkout endpoint", async () => {
  jest
    .mocked(apiClient.post)
    .mockResolvedValue({
      data: { success: true, data: { next_action: "wait" } },
    });
  const controller = new AbortController();
  const response = await createMerchantPlusCheckout(controller.signal);
  expect(response.success).toBe(true);
  expect(apiClient.post).toHaveBeenCalledWith(
    "/merchant/plus/checkout/",
    {},
    { signal: controller.signal },
  );
});

it("sends only the prior checkout reference when requesting a replacement", async () => {
  jest.mocked(apiClient.post).mockResolvedValue({
    data: { success: true, data: { next_action: "open_checkout" } },
  });
  const controller = new AbortController();
  const reference = "87654321-4321-4321-8321-876543218765";

  await createMerchantPlusCheckout(controller.signal, reference);

  expect(apiClient.post).toHaveBeenLastCalledWith(
    "/merchant/plus/checkout/",
    { retry_checkout_reference: reference },
    { signal: controller.signal },
  );
});
