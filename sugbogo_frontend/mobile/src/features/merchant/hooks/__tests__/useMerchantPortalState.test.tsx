import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getCurrentApplication } from "../../api/merchantApplication.service";
import { MerchantRegistrationStatus } from "../../types/merchant.types";
import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";
import { useMerchantPortalState } from "../useMerchantPortalState";

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({
      user: {
        id: 42,
      },
    }),
}));

jest.mock("../../api/merchantApplication.service", () => ({
  getCurrentApplication: jest.fn(),
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

function createApplication(
  status: ApplicationDetailResponse["status"],
): ApplicationDetailResponse {
  return {
    id: 100,
    status,
    highest_completed_step: 5,
    submitted_at: "2026-09-22T00:00:00Z",
    reviewed_at: null,
    submission_count: 1,
    latest_review: null,
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    identity: null,
    location: null,
    operating_hours: [],
    photos: [],
    documents: [],
    review_sla_min_business_days: 3,
    review_sla_max_business_days: 5,
  };
}

describe("useMerchantPortalState", () => {
  it("updates portal state when the centralized current-application cache is invalidated", async () => {
    (getCurrentApplication as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Application loaded.",
        data: createApplication("draft"),
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Application refreshed.",
        data: createApplication("submitted"),
      });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useMerchantPortalState, {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.registrationStatus).toBe(
        MerchantRegistrationStatus.DRAFT,
      ),
    );

    await act(async () => {
      await client.invalidateQueries({
        queryKey: merchantApplicationKeys.current(42),
      });
    });

    await waitFor(() =>
      expect(result.current.registrationStatus).toBe(
        MerchantRegistrationStatus.SUBMITTED,
      ),
    );
    expect(getCurrentApplication).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });
});
