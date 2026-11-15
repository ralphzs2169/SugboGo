import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import useMerchantPlusCheckout from "../useMerchantPlusCheckout";
import * as service from "../../../api/merchantPlusCheckout.service";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";

jest.mock("../../../api/merchantPlusCheckout.service", () => ({
  createMerchantPlusCheckout: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
const client = new QueryClient({
  defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
});
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const checkout = {
  payment_id: 1,
  payment_reference: "local",
  provider: "maya",
  mode: "test",
  amount_centavos: 100,
  currency: "PHP",
  payment_status: "pending",
  fulfilment_status: "not_started",
  checkout_status: "ready",
  checkout_session_id: "fixture",
  checkout_url:
    "https://payments-web-sandbox.paymaya.com/checkout?id=synthetic",
  next_action: "open_checkout",
  status_check_after_seconds: null,
} as const;
beforeEach(() => {
  beginAuthSession();
  jest.clearAllMocks();
  useAuthStore.setState({ user: analyticsMerchant() });
  jest
    .mocked(service.createMerchantPlusCheckout)
    .mockResolvedValue({ success: true, data: checkout, message: "ready" });
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockResolvedValue({
      type: WebBrowser.WebBrowserResultType?.DISMISS ?? "dismiss",
    } as never);
});

it("serializes rapid taps into one checkout action and one browser session", async () => {
  const hook = await renderHook(() => useMerchantPlusCheckout(), {
    wrapper: Wrapper,
  });
  await act(async () => {
    hook.result.current.startCheckout();
    hook.result.current.startCheckout();
  });
  await waitFor(() =>
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1),
  );
  expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
    checkout.checkout_url,
  );
  expect(router.replace).toHaveBeenCalledWith(
    "/(merchant)/merchant-plus/return",
  );
});

it("takes waiting and uncertain results to backend checking without opening a browser", async () => {
  jest
    .mocked(service.createMerchantPlusCheckout)
    .mockResolvedValue({
      success: true,
      data: { ...checkout, next_action: "wait", checkout_url: null },
      message: "wait",
    });
  const hook = await renderHook(() => useMerchantPlusCheckout(), {
    wrapper: Wrapper,
  });
  await act(async () => hook.result.current.startCheckout());
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
});

it.each([
  "https://attacker.invalid/path",
  "http://payments-web-sandbox.paymaya.com/path",
])("rejects unsafe hosted URL %s", async (checkout_url) => {
  jest
    .mocked(service.createMerchantPlusCheckout)
    .mockResolvedValue({
      success: true,
      data: { ...checkout, checkout_url },
      message: "ready",
    });
  const hook = await renderHook(() => useMerchantPlusCheckout(), {
    wrapper: Wrapper,
  });
  await act(async () => hook.result.current.startCheckout());
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
});

it("does not retry a provider error", async () => {
  jest
    .mocked(service.createMerchantPlusCheckout)
    .mockResolvedValue({
      success: false,
      code: "checkout_unavailable",
      message: "unavailable",
    });
  const hook = await renderHook(() => useMerchantPlusCheckout(), {
    wrapper: Wrapper,
  });
  await act(async () => hook.result.current.startCheckout());
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
});

it("suppresses late browser opening after account changes", async () => {
  let finish!: (
    value: Awaited<ReturnType<typeof service.createMerchantPlusCheckout>>,
  ) => void;
  jest.mocked(service.createMerchantPlusCheckout).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const hook = await renderHook(() => useMerchantPlusCheckout(), {
    wrapper: Wrapper,
  });
  await act(async () => hook.result.current.startCheckout());
  await act(async () => useAuthStore.setState({ user: analyticsMerchant(99) }));
  await act(async () =>
    finish({ success: true, data: checkout, message: "ready" }),
  );
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
