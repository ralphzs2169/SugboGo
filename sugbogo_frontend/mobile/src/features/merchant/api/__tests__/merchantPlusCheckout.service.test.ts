import apiClient from "@/shared/api/apiClient.service";
import { createMerchantPlusCheckout } from "../merchantPlusCheckout.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

it("posts only an empty object to the server-owned checkout endpoint", async () => {
  jest.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { next_action: "wait" } } });
  const controller = new AbortController();
  const response = await createMerchantPlusCheckout(controller.signal);
  expect(response.success).toBe(true);
  expect(apiClient.post).toHaveBeenCalledWith("/merchant/plus/checkout/", {}, { signal: controller.signal });
});
