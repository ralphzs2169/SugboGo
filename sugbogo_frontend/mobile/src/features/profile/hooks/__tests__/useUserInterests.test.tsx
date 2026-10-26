import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { getUserInterests } from "../../api/interest.service";
import useUserInterests, {
  userInterestsQueryKey,
} from "../your-interests/useUserInterests";

jest.mock("../../api/interest.service", () => ({
  getUserInterests: jest.fn(),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, wrapper: Wrapper };
}

const interests = {
  categories: [],
  specialty_tags: [],
  available_categories: [],
  available_specialty_tags: [],
};

describe("private interests reads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    (getUserInterests as jest.Mock).mockResolvedValue({
      success: true,
      data: interests,
    });
  });

  it.each(["signed out", "restoring", "missing owner", "expired generation"])(
    "does not fetch or expose private data while %s",
    async (state) => {
      if (state === "signed out") {
        useAuthStore.setState({ isAuthenticated: false });
      }
      if (state === "restoring") {
        useAuthStore.setState({ isLoading: true });
      }
      if (state === "missing owner") {
        useAuthStore.setState({ user: null });
      }
      if (state === "expired generation") {
        invalidateAuthSession();
      }
      const { client, wrapper } = setup();
      client.setQueryData(
        userInterestsQueryKey(1, getAuthSessionGeneration()),
        interests,
      );
      const hook = await renderHook(useUserInterests, { wrapper });
      expect(hook.result.current.isEnabled).toBe(false);
      expect(hook.result.current.data).toBeUndefined();
      await act(async () => {
        await hook.result.current.refetch();
      });
      expect(getUserInterests).not.toHaveBeenCalled();
      await hook.unmount();
      client.clear();
    },
  );

  it("reuses the current session cache on return", async () => {
    const { client, wrapper } = setup();
    const key = userInterestsQueryKey(1, getAuthSessionGeneration());
    const first = await renderHook(useUserInterests, { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(interests));
    expect(client.getQueryData(key)).toEqual(interests);
    await first.unmount();
    const second = await renderHook(useUserInterests, { wrapper });
    expect(second.result.current.data).toEqual(interests);
    expect(getUserInterests).toHaveBeenCalledTimes(1);
    await second.unmount();
    client.clear();
  });

  it.each([1, 2])(
    "isolates a delayed read from a replacement session for owner %s",
    async (nextOwner) => {
      let finish!: (value: unknown) => void;
      (getUserInterests as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const { client, wrapper } = setup();
      const oldKey = userInterestsQueryKey(1, getAuthSessionGeneration());
      const hook = await renderHook(useUserInterests, { wrapper });
      await waitFor(() => expect(getUserInterests).toHaveBeenCalledTimes(1));
      await act(async () => {
        beginAuthSession();
        useAuthStore.getState().setUser({ id: nextOwner } as User);
      });
      await waitFor(() => expect(hook.result.current.data).toEqual(interests));
      await act(async () => {
        finish({
          success: true,
          data: { ...interests, categories: [{ id: 99 }] },
        });
      });
      expect(hook.result.current.userId).toBe(nextOwner);
      expect(hook.result.current.data).toEqual(interests);
      expect(client.getQueryData(oldKey)).toBeUndefined();
      await hook.unmount();
      client.clear();
    },
  );
});
