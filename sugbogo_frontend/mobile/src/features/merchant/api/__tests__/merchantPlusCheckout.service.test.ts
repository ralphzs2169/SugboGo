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
