import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { getInstallationId } from "@/shared/api/storage.service";

import {
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../../api/exploreBusiness.service";
import useBusinessVouch from "../useBusinessVouch";

jest.mock("../../api/exploreBusiness.service", () => ({
  removeBusinessSpecialtyVouch: jest.fn(),
  vouchForBusinessSpecialty: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn(),
}));

describe("useBusinessVouch Community synchronization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("finishes the mutation without waiting for cache refreshes", async () => {
    (getInstallationId as jest.Mock).mockResolvedValue("installation-1");
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { gcTime: 0 },
      },
    });
    let finishRefresh!: () => void;
    const refresh = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const invalidate = jest.spyOn(client, "invalidateQueries")
      .mockReturnValue(refresh);

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => useBusinessVouch({ businessId: 20 }),
      { wrapper: Wrapper },
    );
    let completed = false;

    try {
      await act(async () => {
        void result.current.vouch({ tagId: 4, isVouched: false }).then(() => {
          completed = true;
        });
      });
      await waitFor(() => {
        expect(completed).toBe(true);
        expect(result.current.pendingTagId).toBeNull();
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["explore-business-detail", 20],
      });
    } finally {
      await act(async () => finishRefresh());
      unmount();
      client.clear();
    }
  });

  it.each([
    { name: "add", isVouched: false },
    { name: "remove", isVouched: true },
  ])(
    "invalidates Community after a successful $name",
    async ({ isVouched }) => {
      (getInstallationId as jest.Mock).mockResolvedValue("installation-1");
      (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });
      (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { gcTime: 0 },
      },
      });
      const invalidate = jest.spyOn(client, "invalidateQueries");

      function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
      }

      const { result, unmount } = await renderHook(
        () => useBusinessVouch({ businessId: 20 }),
        { wrapper: Wrapper },
      );
      await act(async () => {
        await result.current.vouch({ tagId: 4, isVouched });
      });

      expect(invalidate).toHaveBeenCalledWith({
        queryKey: COMMUNITY_REVIEWS_QUERY_KEY,
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["activity-timeline"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["explore-business-detail", 20],
      });
      if (isVouched) {
        expect(removeBusinessSpecialtyVouch).toHaveBeenCalledWith(20, 4);
      } else {
        expect(vouchForBusinessSpecialty).toHaveBeenCalledWith(
          20,
          4,
          "installation-1",
        );
      }
      unmount();
      client.clear();
    },
  );
});
