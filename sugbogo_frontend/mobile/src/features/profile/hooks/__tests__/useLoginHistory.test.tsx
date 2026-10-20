import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { getLoginHistory } from "../../api/loginHistory.service";
import type { LoginHistoryResponse } from "../../types/loginHistory.types";
import useLoginHistory from "../useLoginHistory";

let mockUserId: number | undefined = 1;
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: mockUserId ? { id: mockUserId } : null }),
}));
jest.mock("../../api/loginHistory.service", () => ({
  getLoginHistory: jest.fn(),
}));

function page(id: number, hasNext = false, number = 1): LoginHistoryResponse {
  return {
    items: [
      {
        id,
        method: "password",
        outcome: "success",
        platform: "Android",
        client: "Mobile app",
        ip_address: "192.0.2.1",
        created_at: "2026-10-20T06:00:00Z",
      },
    ],
    pagination: {
      page: number,
      page_size: 1,
      total_items: 2,
      total_pages: 2,
      has_next: hasNext,
      has_previous: number > 1,
    },
  };
}

describe("useLoginHistory", () => {
  let client: QueryClient;
  beforeEach(() => {
    mockUserId = 1;
    beginAuthSession();
    jest.mocked(getLoginHistory).mockReset();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    invalidateAuthSession();
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("preserves server order and requests the next page only when available", async () => {
    jest
      .mocked(getLoginHistory)
      .mockResolvedValueOnce({
        success: true,
        message: "",
        data: page(20, true),
      })
      .mockResolvedValueOnce({
        success: true,
        message: "",
        data: page(10, false, 2),
      });
    const { result } = await renderHook(useLoginHistory, { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.events.map((event) => event.id)).toEqual([20, 10]);
    expect(getLoginHistory).toHaveBeenNthCalledWith(2, 2);
  });

  it("does not fetch signed-out activity and isolates account caches", async () => {
    mockUserId = undefined;
    jest
      .mocked(getLoginHistory)
      .mockResolvedValue({ success: true, message: "", data: page(1) });
    const { result, rerender } = await renderHook(useLoginHistory, {
      wrapper: Wrapper,
    });
    expect(getLoginHistory).not.toHaveBeenCalled();
    mockUserId = 1;
    await rerender(undefined);
    await waitFor(() => expect(result.current.events[0]?.id).toBe(1));
    mockUserId = 2;
    beginAuthSession();
    jest
      .mocked(getLoginHistory)
      .mockResolvedValue({ success: true, message: "", data: page(2) });
    await rerender(undefined);
    await waitFor(() => expect(result.current.events[0]?.id).toBe(2));
    expect(
      client.getQueryData<LoginHistoryResponse>(["login-history", 1]),
    ).toBeDefined();
  });

  it("rejects an in-flight response after the session changes", async () => {
    let finish!: (
      response: Awaited<ReturnType<typeof getLoginHistory>>,
    ) => void;
    jest.mocked(getLoginHistory).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(useLoginHistory, { wrapper: Wrapper });
    await waitFor(() => expect(getLoginHistory).toHaveBeenCalledTimes(1));
    invalidateAuthSession();
    await act(async () =>
      finish({ success: true, message: "", data: page(99) }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.events).toEqual([]);
    expect(client.getQueryData(["login-history", 1])).toBeUndefined();
  });
});
