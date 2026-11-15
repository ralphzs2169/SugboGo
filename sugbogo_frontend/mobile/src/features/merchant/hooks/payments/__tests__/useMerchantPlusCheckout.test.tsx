import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import useMerchantPlusCheckout from "../useMerchantPlusCheckout";
import * as service from "../../../api/merchantPlusCheckout.service";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import { plusStatus } from "../../../__tests__/merchantPlusAnalytics.fixtures";
import { merchantPlusPaymentState } from "../../../utils/merchantPlusPayment";
import { merchantPlusStatusKey } from "../../analytics/merchantPlusAnalyticsQueryKeys";

jest.mock("../../../api/merchantPlusCheckout.service", () => ({
  createMerchantPlusCheckout: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() },
}));
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
  client.clear();
  useAuthStore.setState({ user: analyticsMerchant() });
  jest
    .mocked(service.createMerchantPlusCheckout)
    .mockResolvedValue({ success: true, data: checkout, message: "ready" });
  jest.mocked(WebBrowser.openBrowserAsync).mockResolvedValue({
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
  expect(router.replace).not.toHaveBeenCalled();
});

it("reopens the returned existing URL only after another explicit Continue action", async () => {
  const before = {
    ...plusStatus(false),
    unresolved_payment_id: checkout.payment_id,
    unresolved_payment_status: "pending" as const,
    checkout_outcome: "pending" as const,
    checkout_can_resume: true,
  };
  const fetchStatus = jest.fn().mockResolvedValue(before);
  const hook = await renderHook(
    () => {
      const action = useMerchantPlusCheckout();
      const status = useQuery({
        queryKey: merchantPlusStatusKey(analyticsMerchant().id),
        queryFn: fetchStatus,
      });
      return { action, status: status.data };
    },
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(hook.result.current.status).toEqual(before));
  expect(service.createMerchantPlusCheckout).not.toHaveBeenCalled();

  await act(async () => hook.result.current.action.startCheckout());
  await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(2));
  expect(hook.result.current.action.busy).toBe(false);
  expect(hook.result.current.status).toEqual(before);
  expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);

  await act(async () => hook.result.current.action.startCheckout());
  await waitFor(() =>
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(2),
  );
  expect(WebBrowser.openBrowserAsync).toHaveBeenNthCalledWith(
    1,
    checkout.checkout_url,
  );
  expect(WebBrowser.openBrowserAsync).toHaveBeenNthCalledWith(
    2,
    checkout.checkout_url,
  );
  expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(2);
  expect(router.replace).not.toHaveBeenCalled();
});

it.each([
  [true, "pending", "pending", "checking"],
  [false, "pending", "pending", "checking"],
  [false, "cancelled", "pending", "cancelled"],
  [false, "failed", "pending", "failed"],
  [false, "cancelled", "paid", "activating"],
] as const)(
  "refreshes after browser close (history %s, outcome %s, payment %s)",
  async (history, checkoutOutcome, paymentStatus, expectedState) => {
    jest.mocked(router.canGoBack).mockReturnValue(history);
    let closeBrowser!: (result: WebBrowser.WebBrowserResult) => void;
    jest.mocked(WebBrowser.openBrowserAsync).mockReturnValue(
      new Promise((resolve) => {
        closeBrowser = resolve;
      }),
    );
    const before = {
      ...plusStatus(false),
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending" as const,
      checkout_outcome: "pending" as const,
    };
    const fetchStatus = jest.fn().mockResolvedValue(before);
    const hook = await renderHook(
      () => {
        const action = useMerchantPlusCheckout();
        const status = useQuery({
          queryKey: merchantPlusStatusKey(analyticsMerchant().id),
          queryFn: fetchStatus,
        });
        return { action, status: status.data };
      },
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(hook.result.current.status).toEqual(before));
    await act(async () => hook.result.current.action.startCheckout());
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalled());
    fetchStatus.mockResolvedValue({
      ...before,
      checkout_outcome: checkoutOutcome,
      unresolved_payment_status: paymentStatus,
    });
    await act(async () =>
      closeBrowser({ type: "cancel" } as WebBrowser.WebBrowserResult),
    );
    await waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(2);
      expect(merchantPlusPaymentState(hook.result.current.status)).toBe(
        expectedState,
      );
    });
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
  },
);

it("refreshes again when Android returns from the opened custom tab", async () => {
  const platform = jest.replaceProperty(Platform, "OS", "android");
  let onAppStateChange!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const listener = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      onAppStateChange = callback;
      return { remove };
    });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockResolvedValue({ type: "opened" } as WebBrowser.WebBrowserResult);
  try {
    const hook = await renderHook(() => useMerchantPlusCheckout(), {
      wrapper: Wrapper,
    });
    await act(async () => hook.result.current.startCheckout());
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    await act(async () => {
      onAppStateChange("background");
      onAppStateChange("active");
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
  } finally {
    platform.restore();
    listener.mockRestore();
    invalidate.mockRestore();
  }
});

it("takes waiting and uncertain results to backend checking without opening a browser", async () => {
  jest.mocked(service.createMerchantPlusCheckout).mockResolvedValue({
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
  expect(service.createMerchantPlusCheckout).toHaveBeenCalledTimes(1);
  expect(hook.result.current.error).toBeNull();
  expect(router.replace).toHaveBeenCalledWith(
    "/(merchant)/merchant-plus/return",
  );
});

it.each([
  "https://attacker.invalid/path",
  "http://payments-web-sandbox.paymaya.com/path",
])("rejects unsafe hosted URL %s", async (checkout_url) => {
  jest.mocked(service.createMerchantPlusCheckout).mockResolvedValue({
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
  jest.mocked(service.createMerchantPlusCheckout).mockResolvedValue({
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
