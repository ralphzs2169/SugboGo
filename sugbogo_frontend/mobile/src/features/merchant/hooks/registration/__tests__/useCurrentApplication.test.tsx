import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getCurrentApplication } from "../../../api/merchantApplication.service";
import { merchantApplicationKeys } from "../../merchantApplicationQueryKeys";
import useCurrentApplication from "../useCurrentApplication";

let mockUserId: number | undefined;

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } | null }) => unknown) =>
    selector({
      user: mockUserId ? { id: mockUserId } : null,
    }),
}));

jest.mock("../../../api/merchantApplication.service", () => ({
  getCurrentApplication: jest.fn(),
}));

function createApplication(id: number) {
  return {
    id,
    status: "draft" as const,
    highest_completed_step: 1,
    submitted_at: null,
    reviewed_at: null,
    submission_count: 0,
    latest_review: null,
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-21T00:00:00Z",
    identity: null,
    location: null,
    operating_hours: [],
    photos: [],
    documents: [],
    review_sla_min_business_days: 3,
    review_sla_max_business_days: 5,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
}

describe("useCurrentApplication", () => {
  it("scopes current application data by authenticated user", async () => {
    mockUserId = 7;

    (getCurrentApplication as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Application loaded.",
        data: createApplication(70),
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Application loaded.",
        data: createApplication(90),
      });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, rerender, unmount } = await renderHook<
      ReturnType<typeof useCurrentApplication>,
      { userId: number }
    >(
      ({ userId }) => {
        mockUserId = userId;
        return useCurrentApplication();
      },
      {
        initialProps: {
          userId: 7,
        },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.application?.id).toBe(70));

    await act(() => {
      rerender({ userId: 9 });
    });

    await waitFor(() => expect(result.current.application?.id).toBe(90));

    expect(
      client.getQueryData(merchantApplicationKeys.current(7)),
    ).toEqual(createApplication(70));
    expect(
      client.getQueryData(merchantApplicationKeys.current(9)),
    ).toEqual(createApplication(90));
    expect(getCurrentApplication).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });

  it("returns null without a query error when no application exists", async () => {
    mockUserId = 7;

    (getCurrentApplication as jest.Mock).mockResolvedValue({
      success: false,
      message: "Application not found.",
      code: "APPLICATION_NOT_FOUND",
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(useCurrentApplication, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.application).toBeNull();
    expect(result.current.error).toBe(false);
    expect(
      client.getQueryData(merchantApplicationKeys.current(7)),
    ).toBeNull();

    unmount();
    client.clear();
  });

  it("exposes other application failures as query errors", async () => {
    mockUserId = 7;

    (getCurrentApplication as jest.Mock).mockResolvedValue({
      success: false,
      message: "Unable to load application.",
      code: "NETWORK_ERROR",
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(useCurrentApplication, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe(true));

    expect(result.current.application).toBeNull();

    unmount();
    client.clear();
  });

  it("deduplicates current application requests for shared consumers", async () => {
    mockUserId = 7;

    (getCurrentApplication as jest.Mock).mockResolvedValue({
      success: true,
      message: "Application loaded.",
      data: createApplication(70),
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => ({
        first: useCurrentApplication(),
        second: useCurrentApplication(),
      }),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.first.isLoading).toBe(false));

    expect(result.current.first.application).toEqual(createApplication(70));
    expect(result.current.second.application).toEqual(createApplication(70));
    expect(getCurrentApplication).toHaveBeenCalledTimes(1);

    unmount();
    client.clear();
  });
});
