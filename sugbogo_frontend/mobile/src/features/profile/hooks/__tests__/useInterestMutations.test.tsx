import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  completeOnboardingInterests,
  updateUserInterests,
} from "../../api/interest.service";
import {
  useCompleteOnboardingInterests,
  useUpdateUserInterests,
} from "../your-interests/useInterestMutations";
import { getExploreCollectionQueryKey } from "@/features/explore/hooks/useExploreCollection";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/constants/exploreHomepageQueries";
import { userInterestsQueryKey } from "../your-interests/useUserInterests";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

jest.mock("../../api/interest.service", () => ({
  updateUserInterests: jest.fn(),
  completeOnboardingInterests: jest.fn(),
}));

describe("interest mutations", () => {
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it.each(["save", "onboarding"] as const)(
    "invalidates every Interests collection variant after %s without invalidating other collections",
    async (operation) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60 * 1000, gcTime: Infinity },
          mutations: { gcTime: Infinity },
        },
      });
      const criteria = {
        clusterId: null,
        categoryIds: [],
        specialtyTagId: null,
      };
      const variants = [
        criteria,
        { ...criteria, categoryIds: [8] },
        { ...criteria, specialtyTagId: 14 },
        { ...criteria, clusterId: 3 },
        { clusterId: 3, categoryIds: [8, 12], specialtyTagId: 14 },
      ];
      const collectionKeys = variants.map((variant) =>
        getExploreCollectionQueryKey("interests", variant),
      );
      const unrelatedKeys = (
        ["hidden-gems", "new-businesses"] as const
      ).flatMap((type) =>
        variants.map((variant) => getExploreCollectionQueryKey(type, variant)),
      );
      const oldCollection = {
        pages: [{ items: [{ id: 42 }, { id: 7 }] }],
        pageParams: [1],
      };
      for (const key of [...collectionKeys, ...unrelatedKeys]) {
        client.setQueryData(key, oldCollection);
        expect(client.getQueryState(key)?.isInvalidated).toBe(false);
      }
      const interestsKey = userInterestsQueryKey(1, getAuthSessionGeneration());
      client.setQueryData(interestsKey, {
        categories: [{ id: 99 }],
        specialty_tags: [{ id: 100 }],
      });
      const interests = {
        categories: [{ id: 8 }],
        specialty_tags: [{ id: 14 }],
        available_categories: [],
        available_specialty_tags: [],
      };
      (updateUserInterests as jest.Mock).mockResolvedValue({
        success: true,
        data: interests,
      });
      (completeOnboardingInterests as jest.Mock).mockResolvedValue({
        success: true,
        data: interests,
      });
      const homepageFetch = jest.fn().mockResolvedValue({ items: [{ id: 7 }] });
      await client.fetchQuery({
        queryKey: RECOMMENDATIONS_QUERY_KEY,
        queryFn: homepageFetch,
      });
      const invalidate = jest.spyOn(client, "invalidateQueries");

      function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
      }

      const { result, unmount } = await renderHook(
        () => ({
          save: useUpdateUserInterests(),
          onboarding: useCompleteOnboardingInterests(),
        }),
        { wrapper: Wrapper },
      );
      try {
        await act(async () => {
          if (operation === "save") {
            await result.current.save.mutateAsync({
              category_ids: [8],
              specialty_tag_ids: [14],
            });
          } else {
            await result.current.onboarding.mutateAsync([14]);
          }
        });

        expect(client.getQueryData(interestsKey)).toEqual(interests);
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ["explore-collections", "interests"],
        });
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: RECOMMENDATIONS_QUERY_KEY,
          refetchType: "all",
        });
        expect(homepageFetch).toHaveBeenCalledTimes(2);
        for (const key of collectionKeys) {
          expect(client.getQueryState(key)?.isInvalidated).toBe(true);
        }
        for (const key of unrelatedKeys) {
          expect(client.getQueryState(key)?.isInvalidated).toBe(false);
          expect(client.getQueryData(key)).toBe(oldCollection);
        }
      } finally {
        await unmount();
        client.clear();
      }
    },
  );

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

    const { result, unmount } = await renderHook(useUpdateUserInterests, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        category_ids: [8],
        specialty_tag_ids: [14],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      client.getQueryData(userInterestsQueryKey(1, getAuthSessionGeneration())),
    ).toBe(interests);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["explore-recommendations"],
      refetchType: "all",
    });
    await unmount();
    client.clear();
  });

  describe.each(["save", "onboarding"] as const)(
    "%s ownership",
    (operation) => {
      it.each(["logout", "another account", "replacement login"])(
        "ignores a late response after %s without invalidating discovery",
        async (transition) => {
          let finish!: (value: unknown) => void;
          const request =
            operation === "save"
              ? updateUserInterests
              : completeOnboardingInterests;
          (request as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
              finish = resolve;
            }),
          );
          const client = new QueryClient({
            defaultOptions: { mutations: { gcTime: Infinity } },
          });
          function Wrapper({ children }: PropsWithChildren) {
            return (
              <QueryClientProvider client={client}>
                {children}
              </QueryClientProvider>
            );
          }
          const hook = await renderHook(
            () => ({
              save: useUpdateUserInterests(),
              onboarding: useCompleteOnboardingInterests(),
            }),
            { wrapper: Wrapper },
          );
          let pending!: Promise<unknown>;
          await act(async () => {
            pending = (
              operation === "save"
                ? hook.result.current.save.mutateAsync({
                    category_ids: [8],
                    specialty_tag_ids: [14],
                  })
                : hook.result.current.onboarding.mutateAsync([14])
            ).catch((error) => error);
          });
          await waitFor(() => expect(request).toHaveBeenCalled());
          await act(async () => {
            invalidateAuthSession();
            useAuthStore.getState().clearUser();
            client.clear();
            if (transition !== "logout") {
              beginAuthSession();
              useAuthStore.getState().setUser({
                id: transition === "another account" ? 2 : 1,
              } as User);
            }
          });
          const currentKey = userInterestsQueryKey(
            useAuthStore.getState().user?.id ?? null,
            getAuthSessionGeneration(),
          );
          const currentData = { categories: [], specialty_tags: [] };
          client.setQueryData(currentKey, currentData);
          const invalidate = jest.spyOn(client, "invalidateQueries");
          await act(async () => {
            finish({ success: true, data: { categories: [{ id: 8 }] } });
            expect(await pending).toBeInstanceOf(StaleAuthSessionError);
          });
          expect(client.getQueryData(currentKey)).toBe(currentData);
          expect(invalidate).not.toHaveBeenCalled();
          await hook.unmount();
          client.clear();
        },
      );
    },
  );
});
