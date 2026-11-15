import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { AppState } from "react-native";
import type { PropsWithChildren } from "react";
import useMerchantPlusPaymentStatus, {
  PAYMENT_CHECK_LIMIT,
  PAYMENT_CHECK_INTERVAL,
} from "../useMerchantPlusPaymentStatus";
import { plusStatus } from "../../../__tests__/merchantPlusAnalytics.fixtures";

let mockAccount = 42;
const mockRefetch = jest.fn();
const mockReconcile = jest.fn();
const mockPending = {
  ...plusStatus(false),
  unresolved_payment_id: 1,
  unresolved_payment_status: "pending",
  checkout_outcome: "pending",
};
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("../../../api/merchantPlusCheckout.service", () => ({
  reconcileMerchantPlusPayment: (...args: unknown[]) => mockReconcile(...args),
}));
jest.mock("../../analytics/useMerchantPlusAccess", () => ({
  __esModule: true,
  default: () => ({
    accountId: mockAccount,
    refetch: mockRefetch,
    allowed: false,
    status: mockPending,
  }),
}));
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  beginAuthSession();
  jest.useFakeTimers();
  mockAccount = 42;
  mockRefetch.mockReset().mockResolvedValue({ data: mockPending });
  mockReconcile
    .mockReset()
    .mockResolvedValue({ success: true, data: mockPending });
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    value: "active",
  });
});
afterEach(() => jest.useRealTimers());

it("refreshes immediately and stops after the bounded attempt limit", async () => {
  const hook = await renderHook(() => useMerchantPlusPaymentStatus(), {
    wrapper: Wrapper,
  });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  for (let count = 0; count < PAYMENT_CHECK_LIMIT; count += 1) {
    await act(async () => jest.advanceTimersByTime(PAYMENT_CHECK_INTERVAL));
  }
  expect(mockRefetch).toHaveBeenCalledTimes(PAYMENT_CHECK_LIMIT);
  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(hook.result.current.exhausted).toBe(true);
  await act(async () => hook.result.current.checkAgain());
  expect(mockRefetch).toHaveBeenCalledTimes(PAYMENT_CHECK_LIMIT + 1);
  expect(mockReconcile).toHaveBeenCalledTimes(2);
});

it("reconciles before status reads and recovers from a temporary provider failure", async () => {
  mockReconcile.mockResolvedValueOnce({
    success: false,
    code: "payment_reconciliation_unavailable",
  });
  const hook = await renderHook(() => useMerchantPlusPaymentStatus(), {
    wrapper: Wrapper,
  });
  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(mockReconcile.mock.invocationCallOrder[0]).toBeLessThan(
    mockRefetch.mock.invocationCallOrder[0],
  );
  expect(hook.result.current.error?.message).toContain("couldn't verify");
  await act(async () => jest.advanceTimersByTime(120000));
  expect(mockRefetch).toHaveBeenCalledTimes(1);

  await act(async () => hook.result.current.checkAgain());
  expect(mockReconcile).toHaveBeenCalledTimes(2);
  expect(hook.result.current.error).toBeNull();
});

it("keeps verified paid access authoritative if reconciliation times out", async () => {
  mockReconcile.mockRejectedValueOnce(new Error("provider timeout"));
  mockRefetch.mockResolvedValue({
    data: {
      ...mockPending,
      unresolved_payment_status: "paid",
      unresolved_fulfilment_status: "pending",
    },
  });
  const hook = await renderHook(() => useMerchantPlusPaymentStatus(), {
    wrapper: Wrapper,
  });
  expect(hook.result.current.error).toBeNull();
  await act(async () => jest.advanceTimersByTime(PAYMENT_CHECK_INTERVAL));
  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(mockRefetch).toHaveBeenCalledTimes(2);
});

it.each(["active", "cancelled", "failed", "expired", "unknown", "error"])(
  "stops polling after %s",
  async (state) => {
    const status =
      state === "active"
        ? {
            ...plusStatus(true),
            access_source: "maya_test",
            paid_payment_id: 7,
            entitlement_expires_at: "2026-12-15T04:00:00Z",
          }
        : { ...mockPending, checkout_outcome: state };
    mockRefetch.mockResolvedValue(
      state === "error" ? { error: new Error("offline") } : { data: status },
    );
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await renderHook(() => useMerchantPlusPaymentStatus(), {
      wrapper: Wrapper,
    });
    await act(async () => jest.advanceTimersByTime(120000));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    if (state === "active") expect(invalidate).toHaveBeenCalled();
  },
);

it("cancels the old polling loop when the account changes", async () => {
  let finish!: (value: unknown) => void;
  mockRefetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const hook = await renderHook(() => useMerchantPlusPaymentStatus(), {
    wrapper: Wrapper,
  });
  mockAccount = 99;
  await hook.rerender({});
  await act(async () => finish({ data: mockPending }));
  await act(async () => jest.advanceTimersByTime(PAYMENT_CHECK_INTERVAL));
  expect(mockRefetch).toHaveBeenCalledTimes(3);
});
