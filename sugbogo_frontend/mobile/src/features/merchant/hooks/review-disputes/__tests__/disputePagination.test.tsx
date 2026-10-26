import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import * as service from "../../../api/reviewDispute.service";
import {
  usePendingReviewDisputeCount,
  useReviewDisputes,
} from "../useReviewDisputes";
import ReviewDisputesScreen from "../../../screens/merchant-mode/ReviewDisputesScreen";

jest.mock("../../../api/reviewDispute.service", () => ({
  getReviewDisputes: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 20,
}));
jest.mock("@/shared/components/Avatar", () => () => null);
jest.mock(
  "../../../components/review-disputes/ReviewDisputeScreenSkeleton",
  () => () => null,
);
jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").View,
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
const get = jest.mocked(service.getReviewDisputes);
function page(id: number, number = 1, next = false, total = 1) {
  return {
    success: true as const,
    message: "Success",
    data: {
      items: id
        ? [
            {
              id,
              attempt_number: id,
              status: "pending",
              reason: "fake_review",
              created_at: "2026-01-01",
              review: {
                text: `Review ${id}`,
                author: { first_name: "Ana", last_name: "Cruz" },
              },
            },
          ]
        : [],
      pagination: {
        page: number,
        page_size: 10,
        has_next: next,
        has_previous: number > 1,
        total_items: total,
        total_pages: next ? number + 1 : number,
      },
    },
  } as Awaited<ReturnType<typeof service.getReviewDisputes>>;
}
const offline = {
  success: false as const,
  code: "NETWORK_ERROR",
  message: "Offline",
};
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  get.mockReset().mockResolvedValue(page(1));
});
afterEach(async () => {
  await cleanup();
  client.clear();
});

test("loads pages on demand, preserves pages after pagination failure and retries that page", async () => {
  get
    .mockResolvedValueOnce(page(1, 1, true, 101))
    .mockResolvedValueOnce(offline)
    .mockResolvedValueOnce(page(101, 2));
  const hook = await renderHook(() => useReviewDisputes(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.disputes).toHaveLength(1));
  expect(get).toHaveBeenCalledTimes(1);
  await act(async () => {
    await hook.result.current.fetchNextPage();
  });
  expect(hook.result.current.isFetchNextPageError).toBe(true);
  expect(hook.result.current.disputes[0].id).toBe(1);
  await act(async () => {
    await hook.result.current.fetchNextPage();
  });
  await waitFor(() =>
    expect(hook.result.current.disputes.map((item) => item.id)).toEqual([
      1, 101,
    ]),
  );
  expect(get.mock.calls.map((call) => call[0])).toEqual([1, 2, 2]);
});

test("uses independent server-filtered pages and server totals rather than loaded row counts", async () => {
  get.mockResolvedValue(page(7, 1, true, 123));
  const hook = await renderHook(
    ({ filter }: { filter: service.ReviewDisputeFilter }) =>
      useReviewDisputes(filter),
    { wrapper: Wrapper, initialProps: { filter: "pending" } },
  );
  await waitFor(() =>
    expect(hook.result.current.pagination?.total_items).toBe(123),
  );
  expect(get).toHaveBeenLastCalledWith(1, "pending");
  await hook.rerender({ filter: "resolved" });
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(1, "resolved"));
  const count = await renderHook(() => usePendingReviewDisputeCount(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(count.result.current.count).toBe(123));
  expect(get).toHaveBeenLastCalledWith(1, "pending", 1);
});

test("pending count failure stays unknown, while successful zero is zero", async () => {
  get
    .mockResolvedValueOnce(offline)
    .mockResolvedValueOnce(page(0, 1, false, 0));
  const hook = await renderHook(() => usePendingReviewDisputeCount(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(hook.result.current.count).toBeUndefined();
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.count).toBe(0));
});

test("list exposes older records, targeted pagination Retry, and server filter empty states", async () => {
  get
    .mockResolvedValueOnce(page(1, 1, true, 101))
    .mockResolvedValueOnce(offline)
    .mockResolvedValueOnce(page(101, 2))
    .mockResolvedValueOnce(page(0, 1, false, 0));
  const screen = await render(
    <Wrapper>
      <ReviewDisputesScreen />
    </Wrapper>,
  );
  await screen.findByText("Dispute attempt 1");
  await act(() => {
    void fireEvent(screen.getByTestId("merchant-disputes-list"), "endReached");
  });
  await screen.findByText("Unable to load more disputes");
  expect(screen.getByText("Dispute attempt 1")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", {
      name: /Unable to load more disputes.*retry/i,
    }),
  );
  await screen.findByText("Dispute attempt 101");
  await fireEvent.press(screen.getByText("Resolved"));
  await screen.findByText("No resolved disputes yet");
  expect(get).toHaveBeenLastCalledWith(1, "resolved");
});

test("cached refresh failure keeps content and clears after targeted Retry", async () => {
  const screen = await render(
    <Wrapper>
      <ReviewDisputesScreen />
    </Wrapper>,
  );
  await screen.findByText("Dispute attempt 1");
  get.mockResolvedValueOnce(offline);
  await act(async () => {
    await client.invalidateQueries();
  });
  await screen.findByText("Unable to refresh disputes");
  expect(screen.getByText("Dispute attempt 1")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: /Unable to refresh disputes.*retry/i }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Unable to refresh disputes")).toBeNull(),
  );
});

test("initial and terminal failures render full recovery rather than an empty collection", async () => {
  get.mockResolvedValueOnce(offline);
  const screen = await render(
    <Wrapper>
      <ReviewDisputesScreen />
    </Wrapper>,
  );
  await screen.findByText("Unable to load disputes");
  expect(screen.queryByText("No review disputes")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Dispute attempt 1");
  get.mockResolvedValueOnce({
    success: false,
    code: "PERMISSION_DENIED",
    message: "Access revoked",
  });
  await act(async () => {
    await client.invalidateQueries();
  });
  await screen.findByText("Unable to load disputes");
  expect(screen.queryByText("Dispute attempt 1")).toBeNull();
});
