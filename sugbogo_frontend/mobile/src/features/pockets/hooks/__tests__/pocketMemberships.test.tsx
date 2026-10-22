import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import { DISCOVERY_RESULTS_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "@/features/explore/hooks/useExploreCollection";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "@/features/explore/hooks/useSimilarBusinesses";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import {
  applyOfflinePocketMembershipChange,
  captureOfflinePocketContext,
} from "@/features/offline-pockets/services/offlinePockets.service";
import type {
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";
import {
  getBusinessPocketMemberships,
  replaceBusinessPocketMemberships,
} from "../../api/pockets.service";
import type { BusinessPocketMemberships } from "../../types/pockets.types";
import {
  businessPocketMembershipsQueryKey,
  pocketCollectionQueryKey,
  pocketCollectionsQueryKey,
} from "../pocketQueryKeys";
import useBusinessPocketMemberships from "../useBusinessPocketMemberships";
import useReplacePocketMemberships from "../useReplacePocketMemberships";

jest.mock("../../api/pockets.service", () => ({
  getBusinessPocketMemberships: jest.fn(),
  replaceBusinessPocketMemberships: jest.fn(),
}));
jest.mock("@/features/offline-pockets/services/offlinePockets.service", () => ({
  captureOfflinePocketContext: jest.fn(),
  getOfflinePocketControl: jest.fn().mockResolvedValue(null),
  applyOfflinePocketMembershipChange: jest.fn(),
}));
jest.mock(
  "@/features/offline-pockets/services/offlinePocketSync.service",
  () => ({ requestOfflinePocketSync: jest.fn() }),
);
const initialAuth = useAuthStore.getState();
const response = (
  ids: number[],
): ApiSuccessWithData<BusinessPocketMemberships> => ({
  success: true,
  message: "Success.",
  data: { business_id: 42, pocket_ids: ids, is_pocketed: ids.length > 0 },
});
const apiError = {
  success: false as const,
  code: "VALIDATION_ERROR",
  message: "You cannot save an inactive business.",
};
function user(id: number): User {
  return {
    id,
    first_name: "Pocket",
    last_name: "Explorer",
    gender: null,
    email: `${id}@example.com`,
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  };
}
function deferred<T = ApiResponse<BusinessPocketMemberships>>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Pocket membership queries and replacements", () => {
  let client: QueryClient;
  let unsubscribeReads: (() => void)[];
  beforeEach(() => {
    jest
      .mocked(captureOfflinePocketContext)
      .mockReset()
      .mockRejectedValue(new Error("Local database unavailable"));
    jest.mocked(applyOfflinePocketMembershipChange).mockReset();
    unsubscribeReads = [];
    beginAuthSession();
    useAuthStore.setState({
      user: user(1),
      isAuthenticated: true,
      isLoading: false,
    });
    jest
      .mocked(getBusinessPocketMemberships)
      .mockReset()
      .mockResolvedValue(response([20, 999]));
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReset()
      .mockResolvedValue(response([20]));
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
  });
  afterEach(async () => {
    await cleanup();
    unsubscribeReads.forEach((unsubscribe) => unsubscribe());
    client.clear();
    useAuthStore.setState(initialAuth);
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("captures offline policy before query cancellation and keeps local enqueue failure out of mutation errors", async () => {
    const generation = getAuthSessionGeneration();
    jest.mocked(captureOfflinePocketContext).mockResolvedValue({
      apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      ownerId: 1,
      sessionGeneration: generation,
      clearGeneration: 0,
    });
    jest.mocked(getBusinessPocketMemberships).mockResolvedValue(response([]));
    jest
      .mocked(applyOfflinePocketMembershipChange)
      .mockRejectedValue(new Error("Disk full"));
    const cancel = jest.spyOn(client, "cancelQueries");
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    await act(async () => {
      expect((await result.current.replaceMemberships([20])).is_pocketed).toBe(
        true,
      );
    });
    await waitFor(() =>
      expect(applyOfflinePocketMembershipChange).toHaveBeenCalled(),
    );
    expect(result.current.error).toBeNull();
    expect(
      client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
    ).toEqual(response([20]).data);
    expect(
      jest.mocked(captureOfflinePocketContext).mock.invocationCallOrder[0],
    ).toBeLessThan(cancel.mock.invocationCallOrder[0]);
  });

  it("reads the full authoritative selection with an isolated key", async () => {
    const { result } = await renderHook(
      () => useBusinessPocketMemberships(42),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.memberships?.pocket_ids).toEqual([20, 999]),
    );
    expect(businessPocketMembershipsQueryKey(1, 42)).not.toEqual(
      businessPocketMembershipsQueryKey(2, 42),
    );
    expect(businessPocketMembershipsQueryKey(1, 42)).not.toEqual(
      businessPocketMembershipsQueryKey(1, 7),
    );
  });
  it.each([null, 0, -1, NaN, 1.5])(
    "blocks invalid business ID %s, including manual reads and writes",
    async (id) => {
      const { result } = await renderHook(
        () => ({
          read: useBusinessPocketMemberships(id),
          write: useReplacePocketMemberships(id),
        }),
        { wrapper: Wrapper },
      );
      await act(async () => {
        await result.current.read.refetch();
        await expect(
          result.current.write.replaceMemberships([]),
        ).rejects.toBeInstanceOf(Error);
      });
      expect(getBusinessPocketMemberships).not.toHaveBeenCalled();
      expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
    },
  );
  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: user(1), isAuthenticated: true, isLoading: true },
  ])("guards unavailable session %#", async (state) => {
    useAuthStore.setState(state);
    const { result } = await renderHook(
      () => ({
        read: useBusinessPocketMemberships(42),
        write: useReplacePocketMemberships(42),
      }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await result.current.read.refetch();
      await expect(
        result.current.write.replaceMemberships([]),
      ).rejects.toBeInstanceOf(Error);
    });
    expect(getBusinessPocketMemberships).not.toHaveBeenCalled();
    expect(replaceBusinessPocketMemberships).not.toHaveBeenCalled();
  });
  it("preserves read failures and inherits retry configuration", async () => {
    client.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0, gcTime: Infinity },
    });
    jest
      .mocked(getBusinessPocketMemberships)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(response([]));
    const { result } = await renderHook(
      () => useBusinessPocketMemberships(42),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.memberships?.pocket_ids).toEqual([]),
    );
    expect(getBusinessPocketMemberships).toHaveBeenCalledTimes(2);
  });
  it("hides old-account data and blocks refetches of old-account queries", async () => {
    const pending = deferred();
    jest
      .mocked(getBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response([]));
    const { result } = await renderHook(
      () => useBusinessPocketMemberships(42),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(getBusinessPocketMemberships).toHaveBeenCalledTimes(1),
    );
    await act(async () => useAuthStore.setState({ user: user(2) }));
    await waitFor(() =>
      expect(result.current.memberships?.pocket_ids).toEqual([]),
    );
    await act(async () => {
      pending.resolve(response([999]));
      await client.refetchQueries({
        queryKey: businessPocketMembershipsQueryKey(1, 42),
        exact: true,
        type: "all",
      });
    });
    expect(result.current.memberships?.pocket_ids).toEqual([]);
    expect(getBusinessPocketMemberships).toHaveBeenCalledTimes(2);
  });
  it("applies only confirmed aggregate flags without changing business or recommendation order", async () => {
    const first = { id: 42, is_pocketed: false, review_count: 3 };
    const second = { id: 7, is_pocketed: true };
    const feed = { items: [second, first], pagination: { total_items: 2 } };
    client.setQueryData(RECOMMENDATIONS_QUERY_KEY, feed);
    client.setQueryData(["explore-business-detail", 42], first);
    client.setQueryData([...DISCOVERY_RESULTS_QUERY_KEY, "criteria"], {
      pages: [feed],
      pageParams: [1],
    });
    client.setQueryData([...EXPLORE_COLLECTIONS_QUERY_KEY, "hidden-gems"], {
      pages: [feed],
      pageParams: [1],
    });
    client.setQueryData([...SIMILAR_BUSINESSES_QUERY_KEY, 9], [second, first]);
    client.setQueryData(pocketCollectionQueryKey(1, 20), {
      id: 20,
      business_count: 8,
    });
    client.setQueryData(pocketCollectionsQueryKey(2), { untouched: true });
    const pending = deferred();
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = result.current.replaceMemberships([20, 999]);
    });
    expect(client.getQueryData(["explore-business-detail", 42])).toEqual(first);
    await act(async () => {
      pending.resolve(response([20, 999]));
      await saving;
    });
    expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
      ...first,
      is_pocketed: true,
    });
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual({
      ...feed,
      items: [second, { ...first, is_pocketed: true }],
    });
    for (const key of [
      [...DISCOVERY_RESULTS_QUERY_KEY, "criteria"],
      [...EXPLORE_COLLECTIONS_QUERY_KEY, "hidden-gems"],
    ]) {
      expect(client.getQueryData(key)).toEqual({
        pages: [{ ...feed, items: [second, { ...first, is_pocketed: true }] }],
        pageParams: [1],
      });
    }
    expect(client.getQueryData([...SIMILAR_BUSINESSES_QUERY_KEY, 9])).toEqual([
      second,
      { ...first, is_pocketed: true },
    ]);
    expect(client.getQueryData(pocketCollectionQueryKey(1, 20))).toEqual({
      id: 20,
      business_count: 8,
    });
    expect(
      client.getQueryState(pocketCollectionQueryKey(1, 20))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
    ).toBe(false);
  });
  it("supports clearing every membership and rejects duplicate pending submissions", async () => {
    const pending = deferred();
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = result.current.replaceMemberships([]);
      await expect(
        result.current.replaceMemberships([20]),
      ).rejects.toBeInstanceOf(Error);
    });
    await act(async () => {
      pending.resolve(response([]));
      await saving;
    });
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1);
    expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, []);
    expect(
      client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
    ).toMatchObject({ is_pocketed: false });
  });
  it("preserves existing caches on a failed replacement", async () => {
    client.setQueryData(["explore-business-detail", 42], {
      id: 42,
      is_pocketed: true,
    });
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockResolvedValueOnce(apiError);
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.replaceMemberships([])).rejects.toEqual(
        apiError,
      );
    });
    expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
      id: 42,
      is_pocketed: true,
    });
  });
  it.each([
    { operation: "save", succeeds: true, wasSaved: false, ids: [20] },
    { operation: "save", succeeds: false, wasSaved: false, ids: [20] },
    { operation: "unsave", succeeds: true, wasSaved: true, ids: [] },
    { operation: "unsave", succeeds: false, wasSaved: true, ids: [] },
  ])(
    "recovers an initial Explore read after $operation (success=$succeeds)",
    async ({ succeeds, wasSaved, ids }) => {
      const saved = succeeds ? ids.length > 0 : wasSaved;
      const feed = { items: [{ id: 42, is_pocketed: saved }] };
      const originalRead = deferred<typeof feed>();
      const recoveryRead = deferred<typeof feed>();
      const readFeed = jest
        .fn()
        .mockReturnValueOnce(originalRead.promise)
        .mockReturnValue(recoveryRead.promise);
      const observer = new QueryObserver(client, {
        queryKey: DISCOVERY_FEED_QUERY_KEY,
        queryFn: readFeed,
      });
      unsubscribeReads.push(observer.subscribe(() => {}));
      expect(observer.getCurrentResult().isLoading).toBe(true);

      const recommendations = {
        items: [
          { id: 7, is_pocketed: true },
          { id: 42, is_pocketed: wasSaved },
        ],
      };
      client.setQueryData(RECOMMENDATIONS_QUERY_KEY, recommendations);
      const readRecommendations = jest.fn();
      const recommendationsObserver = new QueryObserver(client, {
        queryKey: RECOMMENDATIONS_QUERY_KEY,
        queryFn: readRecommendations,
        staleTime: Infinity,
      });
      unsubscribeReads.push(recommendationsObserver.subscribe(() => {}));
      client.setQueryData(pocketCollectionsQueryKey(2), { untouched: true });
      const pending = deferred();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(pending.promise);
      const { result, rerender } = await renderHook(
        () => useReplacePocketMemberships(42),
        { wrapper: Wrapper },
      );
      let saving!: Promise<unknown>;
      await act(async () => {
        saving = result.current
          .replaceMemberships(ids)
          .catch((error: unknown) => error);
      });
      await waitFor(() =>
        expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1),
      );
      expect(readFeed).toHaveBeenCalledTimes(1);
      const writeFailure = {
        success: false as const,
        code: "NETWORK_ERROR",
        message: "Offline",
      };
      await act(async () => {
        pending.resolve(succeeds ? response(ids) : writeFailure);
      });
      await waitFor(() => expect(readFeed).toHaveBeenCalledTimes(2));
      expect(observer.getCurrentResult().isLoading).toBe(true);
      await act(async () => {
        originalRead.resolve({ items: [{ id: 42, is_pocketed: !saved }] });
      });
      expect(observer.getCurrentResult().data).toBeUndefined();
      await act(async () => {
        recoveryRead.resolve(feed);
        expect(await saving).toEqual(
          succeeds ? response(ids).data : writeFailure,
        );
      });
      await rerender(undefined);
      expect(observer.getCurrentResult().data).toEqual(feed);
      expect(observer.getCurrentResult().fetchStatus).toBe("idle");
      expect(readFeed).toHaveBeenCalledTimes(2);
      expect(readRecommendations).not.toHaveBeenCalled();
      expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual({
        items: [
          recommendations.items[0],
          { ...recommendations.items[1], is_pocketed: saved },
        ],
      });
      expect(client.getQueryData(pocketCollectionsQueryKey(2))).toEqual({
        untouched: true,
      });
      expect(
        client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
      ).toBe(false);
      expect(replaceBusinessPocketMemberships).toHaveBeenCalledWith(42, ids);
    },
  );
  it("exposes a failed recovery read without failing a confirmed save or refetching in a loop", async () => {
    const originalRead = deferred<{ items: never[] }>();
    const failure = new Error("Explore is offline");
    const readFeed = jest
      .fn()
      .mockReturnValueOnce(originalRead.promise)
      .mockRejectedValue(failure);
    const observer = new QueryObserver(client, {
      queryKey: DISCOVERY_FEED_QUERY_KEY,
      queryFn: readFeed,
    });
    unsubscribeReads.push(observer.subscribe(() => {}));
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.replaceMemberships([20])).resolves.toEqual(
        response([20]).data,
      );
      originalRead.resolve({ items: [] });
    });
    expect(observer.getCurrentResult().error).toBe(failure);
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(observer.getCurrentResult().fetchStatus).toBe("idle");
    expect(readFeed).toHaveBeenCalledTimes(2);
  });
  it("does not restart inactive or disabled reads, or refetch valid empty results", async () => {
    const originalRead = deferred<{ items: never[] }>();
    const readInactive = jest.fn().mockReturnValue(originalRead.promise);
    const inactiveKey = [...DISCOVERY_FEED_QUERY_KEY, "inactive"];
    void client
      .fetchQuery({ queryKey: inactiveKey, queryFn: readInactive })
      .catch(() => {});
    const readDisabled = jest.fn();
    const disabledObserver = new QueryObserver(client, {
      queryKey: [...DISCOVERY_FEED_QUERY_KEY, "disabled"],
      queryFn: readDisabled,
      enabled: false,
    });
    unsubscribeReads.push(disabledObserver.subscribe(() => {}));
    client.setQueryData(RECOMMENDATIONS_QUERY_KEY, { items: [] });
    const readEmpty = jest.fn();
    const emptyObserver = new QueryObserver(client, {
      queryKey: RECOMMENDATIONS_QUERY_KEY,
      queryFn: readEmpty,
      staleTime: Infinity,
    });
    unsubscribeReads.push(emptyObserver.subscribe(() => {}));
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.replaceMemberships([20]);
      originalRead.resolve({ items: [] });
    });
    expect(readInactive).toHaveBeenCalledTimes(1);
    expect(readDisabled).not.toHaveBeenCalled();
    expect(readEmpty).not.toHaveBeenCalled();
    expect(client.getQueryData(inactiveKey)).toBeUndefined();
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual({
      items: [],
    });
  });
  it.each(["success", "failure"])(
    "does not restart old reads or disturb a new account's reads after a late %s",
    async (outcome) => {
      const oldRead = deferred<{ items: { id: number }[] }>();
      const readOldFeed = jest.fn().mockReturnValue(oldRead.promise);
      const oldObserver = new QueryObserver(client, {
        queryKey: DISCOVERY_FEED_QUERY_KEY,
        queryFn: readOldFeed,
      });
      const stopOld = oldObserver.subscribe(() => {});
      unsubscribeReads.push(stopOld);
      const pending = deferred();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(pending.promise);
      const { result } = await renderHook(
        () => useReplacePocketMemberships(42),
        {
          wrapper: Wrapper,
        },
      );
      let saving!: Promise<unknown>;
      await act(async () => {
        saving = result.current
          .replaceMemberships([20])
          .catch((error: unknown) => error);
      });
      await waitFor(() =>
        expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1),
      );
      await act(async () => {
        stopOld();
        client.clear();
        beginAuthSession();
        useAuthStore.setState({ user: user(2) });
      });
      client.setQueryData(pocketCollectionsQueryKey(2), { untouched: true });
      const newRead = deferred<{ items: { id: number }[] }>();
      const readNewFeed = jest.fn().mockReturnValue(newRead.promise);
      const newObserver = new QueryObserver(client, {
        queryKey: DISCOVERY_FEED_QUERY_KEY,
        queryFn: readNewFeed,
      });
      unsubscribeReads.push(newObserver.subscribe(() => {}));
      await act(async () => {
        pending.resolve(outcome === "success" ? response([20]) : apiError);
        await saving;
        oldRead.resolve({ items: [{ id: 999 }] });
      });
      expect(newObserver.getCurrentResult().fetchStatus).toBe("fetching");
      expect(newObserver.getCurrentResult().data).toBeUndefined();
      await act(async () => newRead.resolve({ items: [{ id: 7 }] }));
      expect(newObserver.getCurrentResult().data).toEqual({
        items: [{ id: 7 }],
      });
      expect(readOldFeed).toHaveBeenCalledTimes(1);
      expect(readNewFeed).toHaveBeenCalledTimes(1);
      expect(
        client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
      ).toBe(false);
    },
  );
  it.each(["success", "failure"])(
    "does not write another account's cache after a late %s",
    async (outcome) => {
      const pending = deferred();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(pending.promise);
      const { result } = await renderHook(
        () => useReplacePocketMemberships(42),
        { wrapper: Wrapper },
      );
      let saving!: Promise<unknown>;
      await act(async () => {
        saving = result.current
          .replaceMemberships([20])
          .catch((error: unknown) => error);
      });
      await act(async () => {
        useAuthStore.setState({ user: user(2) });
        client.clear();
        client.setQueryData(["explore-business-detail", 42], {
          id: 42,
          is_pocketed: false,
          owner: 2,
        });
      });
      await act(async () => {
        pending.resolve(outcome === "success" ? response([20]) : apiError);
        await saving;
      });
      expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
        id: 42,
        is_pocketed: false,
        owner: 2,
      });
      expect(
        client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
      ).toBeUndefined();
    },
  );
  it("rejects a late response from a replaced session even for the same user", async () => {
    const pending = deferred();
    jest
      .mocked(replaceBusinessPocketMemberships)
      .mockReturnValueOnce(pending.promise);
    const { result } = await renderHook(() => useReplacePocketMemberships(42), {
      wrapper: Wrapper,
    });
    let saving!: Promise<unknown>;
    await act(async () => {
      saving = result.current
        .replaceMemberships([20])
        .catch((error: unknown) => error);
    });
    beginAuthSession();
    await act(async () => {
      pending.resolve(response([20]));
      expect(await saving).toBeInstanceOf(Error);
    });
    expect(
      client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
    ).toBeUndefined();
  });

  it.each(["success", "failure"])(
    "does not cancel fresh same-account reads after a previous session's late %s",
    async (outcome) => {
      const pending = deferred();
      jest
        .mocked(replaceBusinessPocketMemberships)
        .mockReturnValueOnce(pending.promise);
      const { result } = await renderHook(
        () => useReplacePocketMemberships(42),
        { wrapper: Wrapper },
      );
      let saving!: Promise<unknown>;
      await act(async () => {
        saving = result.current
          .replaceMemberships([20])
          .catch((error: unknown) => error);
      });
      await waitFor(() =>
        expect(replaceBusinessPocketMemberships).toHaveBeenCalledTimes(1),
      );
      beginAuthSession();
      client.clear();
      const fresh = deferred<{ items: number[] }>();
      const read = jest.fn().mockReturnValue(fresh.promise);
      const keys = [
        pocketCollectionsQueryKey(1),
        businessPocketMembershipsQueryKey(1, 42),
      ];
      const observers = keys.map((queryKey) => {
        const observer = new QueryObserver(client, { queryKey, queryFn: read });
        unsubscribeReads.push(observer.subscribe(() => {}));
        return observer;
      });
      await act(async () => {
        pending.resolve(outcome === "success" ? response([20]) : apiError);
        await saving;
      });
      for (const observer of observers)
        expect(observer.getCurrentResult().fetchStatus).toBe("fetching");
      await act(async () => fresh.resolve({ items: [7] }));
      for (const observer of observers)
        expect(observer.getCurrentResult().data).toEqual({ items: [7] });
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
});
