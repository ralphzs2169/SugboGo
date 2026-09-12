import React, { type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { updateUserInterests } from "../../api/interest.service";
import { useUpdateUserInterests } from "../useInterestMutations";
import { USER_INTERESTS_QUERY_KEY } from "../useUserInterests";

jest.mock("../../api/interest.service", () => ({
  updateUserInterests: jest.fn(),
  completeOnboardingInterests: jest.fn(),
}));

describe("interest mutations", () => {
  it("updates interest data and invalidates recommendations after Save", async () => {
    const interests = {
      categories: [],
      specialty_tags: [],
      available_categories: [],
      available_specialty_tags: [],
    };
    (updateUserInterests as jest.Mock).mockResolvedValue({
      success: true,
      data: interests,
    });
    const client = new QueryClient({
      defaultOptions: { mutations: { gcTime: Infinity } },
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result } = await renderHook(useUpdateUserInterests, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        category_ids: [8],
        specialty_tag_ids: [14],
      });
    });

    expect(client.getQueryData(USER_INTERESTS_QUERY_KEY)).toBe(interests);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["explore-recommendations"],
    });
  });
});
