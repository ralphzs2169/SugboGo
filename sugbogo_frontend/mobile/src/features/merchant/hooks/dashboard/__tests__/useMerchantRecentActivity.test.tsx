import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import { recentActivitySnapshot } from "../../../__tests__/merchantRecentActivity.fixtures";
import { getMerchantRecentActivity } from "../../../api/merchantRecentActivity.service";
import { merchantRecentActivityKey } from "../merchantDashboardQueryKeys";
import useMerchantRecentActivity from "../useMerchantRecentActivity";

jest.mock("../../../api/merchantRecentActivity.service", () => ({
  getMerchantRecentActivity: jest.fn(),
}));

const getActivity = jest.mocked(getMerchantRecentActivity);
let client: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  useAuthStore.setState({ user: analyticsMerchant() });
  getActivity.mockReset().mockResolvedValue({
    success: true,
    message: "Success",
    data: recentActivitySnapshot(),
  });
});

afterEach(async () => {
  await cleanup();
  client.clear();
  useAuthStore.setState({ user: null });
});

it("waits for tab focus and refreshes again on re-entry", async () => {
  const { result, rerender } = await renderHook(
    ({ enabled }: { enabled: boolean }) => useMerchantRecentActivity(enabled),
    { wrapper: Wrapper, initialProps: { enabled: false } },
  );
  expect(getActivity).not.toHaveBeenCalled();
  await rerender({ enabled: true });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(getActivity).toHaveBeenCalledTimes(1);
  await rerender({ enabled: false });
  await rerender({ enabled: true });
  await waitFor(() => expect(getActivity).toHaveBeenCalledTimes(2));
});

it("never renders another account's cached activity", async () => {
  const { result } = await renderHook(() => useMerchantRecentActivity(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.data).toBeDefined());
  getActivity.mockReturnValueOnce(new Promise(() => {}));
  await act(async () => useAuthStore.setState({ user: analyticsMerchant(43) }));
  await waitFor(() => expect(getActivity).toHaveBeenCalledTimes(2));
  expect(result.current.data).toBeUndefined();
  expect(client.getQueryData(merchantRecentActivityKey(42))).toBeDefined();
});

it("retains its previous rows when a refresh fails", async () => {
  const { result } = await renderHook(() => useMerchantRecentActivity(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.data?.items).toHaveLength(3));
  getActivity.mockResolvedValueOnce({
    success: false,
    message: "Temporarily unavailable",
    code: "UNAVAILABLE",
  });
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.data?.items).toHaveLength(3);
});
