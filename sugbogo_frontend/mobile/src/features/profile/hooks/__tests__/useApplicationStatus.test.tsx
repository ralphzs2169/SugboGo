import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { merchantApplicationKeys } from "@/features/merchant/hooks/merchantApplicationQueryKeys";
import type { ApplicationStatusResponse } from "@/features/merchant/types/registration/registrationApi.types";
import useApplicationStatus from "../useApplicationStatus";

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({
      user: {
        id: 42,
      },
    }),
}));

jest.mock("@/features/merchant/api/merchantApplication.service", () => ({
  getApplicationStatus: jest.fn(),
}));

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

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function createStatus(
  status: ApplicationStatusResponse["status"],
): ApplicationStatusResponse {
  return {
    status,
    merchant_mode_acknowledged: false,
    highest_completed_step: 5,
    review_sla_min_business_days: 3,
    review_sla_max_business_days: 5,
  };
}

describe("useApplicationStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a successful merchant application status", async () => {
    (getApplicationStatus as jest.Mock).mockResolvedValue({
      success: true,
      message: "Application status loaded.",
      data: createStatus("submitted"),
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useApplicationStatus, {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("submitted");
    expect(result.current.error).toBe(false);
    expect(result.current.hasResolvedStatus).toBe(true);

    unmount();
    client.clear();
  });

  it("distinguishes a successful empty status from a query failure", async () => {
    (getApplicationStatus as jest.Mock).mockResolvedValue({
      success: true,
      message: "No merchant application.",
      data: null,
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useApplicationStatus, {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBe(false);
    expect(result.current.hasResolvedStatus).toBe(true);

    unmount();
    client.clear();
  });

  it("does not mark a failed status request as successfully resolved", async () => {
    (getApplicationStatus as jest.Mock).mockResolvedValue({
      success: false,
      message: "Unable to load application status.",
      code: "NETWORK_ERROR",
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useApplicationStatus, {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe(true));

    expect(result.current.status).toBeNull();
    expect(result.current.hasResolvedStatus).toBe(false);

    unmount();
    client.clear();
  });

  it("keeps cached status visible while invalidation refetches fresh data", async () => {
    const submittedStatus = createStatus("submitted");
    const approvedStatus = createStatus("approved");

    let resolveRefetch: (
      response: {
        success: true;
        message: string;
        data: ApplicationStatusResponse;
      },
    ) => void = () => undefined;
    const pendingRefetch = new Promise<{
      success: true;
      message: string;
      data: ApplicationStatusResponse;
    }>((resolve) => {
      resolveRefetch = resolve;
    });

    (getApplicationStatus as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Application status loaded.",
        data: submittedStatus,
      })
      .mockReturnValueOnce(pendingRefetch);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useApplicationStatus, {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("submitted"));

    await act(async () => {
      void client.invalidateQueries({
        queryKey: merchantApplicationKeys.status(42),
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.status).toBe("submitted");

    resolveRefetch({
      success: true,
      message: "Application status refreshed.",
      data: approvedStatus,
    });

    await waitFor(() => expect(result.current.status).toBe("approved"));
    expect(result.current.isRefetching).toBe(false);

    unmount();
    client.clear();
  });
});
