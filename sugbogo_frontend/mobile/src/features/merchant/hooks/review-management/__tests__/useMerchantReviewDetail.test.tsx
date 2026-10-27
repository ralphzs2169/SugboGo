import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import { getMerchantReviewDetail } from "../../../api/merchantReviewFocus.service";
import { getAllBusinessReviews } from "@/features/explore/api/reviewBusiness.service";
import useMerchantReviewDetail from "../useMerchantReviewDetail";

jest.mock("../../../api/merchantReviewFocus.service", () => ({
  getMerchantReviewDetail: jest.fn(),
}));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  getAllBusinessReviews: jest.fn(),
}));
const read = jest.mocked(getMerchantReviewDetail);
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  useAuthStore.setState({ user: analyticsMerchant() });
  jest.clearAllMocks();
  read.mockResolvedValue({
    success: true,
    message: "Success",
    data: { id: 101, status: "published", active_dispute_id: null },
  } as never);
});
afterEach(async () => {
  await cleanup();
  client.clear();
  useAuthStore.setState({ user: null });
});

test("loads the selected review once without any archive requests, and changes ID safely", async () => {
  const hook = await renderHook(
    ({ id }: { id: number }) => useMerchantReviewDetail(8, id),
    { wrapper: Wrapper, initialProps: { id: 101 } },
  );
  await waitFor(() => expect(hook.result.current.review?.id).toBe(101));
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(8, 101);
  expect(getAllBusinessReviews).not.toHaveBeenCalled();
  read.mockResolvedValueOnce({
    success: true,
    message: "Success",
    data: { id: 102 },
  } as never);
  await hook.rerender({ id: 102 });
  await waitFor(() => expect(hook.result.current.review?.id).toBe(102));
  expect(read).toHaveBeenCalledTimes(2);
});
test.each(["NOT_FOUND", "PERMISSION_DENIED", "NETWORK_ERROR"])(
  "exposes %s and retries only the selected review",
  async (code) => {
    read.mockResolvedValueOnce({
      success: false,
      code,
      message: "Unavailable",
    });
    const hook = await renderHook(() => useMerchantReviewDetail(8, 101), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBeTruthy());
    expect(hook.result.current.review).toBeUndefined();
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() => expect(hook.result.current.review?.id).toBe(101));
    expect(read.mock.calls).toEqual([
      [8, 101],
      [8, 101],
    ]);
    expect(getAllBusinessReviews).not.toHaveBeenCalled();
  },
);
test("waits for the owned business before requesting the selected review", async () => {
  await renderHook(() => useMerchantReviewDetail(0, 101), { wrapper: Wrapper });
  expect(read).not.toHaveBeenCalled();
});
