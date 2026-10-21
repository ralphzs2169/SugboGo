import {
  type InfiniteData,
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
import { getPocketCollections } from "@/features/pockets/api/pockets.service";
import { pocketCollectionsQueryKey } from "@/features/pockets/hooks/pocketQueryKeys";
import usePocketCollections from "@/features/pockets/hooks/usePocketCollections";
import type { PocketCollectionListResponse } from "@/features/pockets/types/pockets.types";
import type { User } from "@/features/users/types/user.types";
import type { ApiError } from "@/shared/types/apiResponse.types";

import {
  pocketBusiness,
  removeBusinessFromPocket,
} from "../../api/exploreBusiness.service";
import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "../../types/exploreBusiness.types";
import useBusinessPocket from "../useBusinessPocket";
import { DISCOVERY_FEED_QUERY_KEY } from "../useDiscoveryFeed";
import { DISCOVERY_RESULTS_QUERY_KEY } from "../useDiscoveryResults";
import { EXPLORE_COLLECTIONS_QUERY_KEY } from "../useExploreCollection";
import { RECOMMENDATIONS_QUERY_KEY } from "../useRecommendations";
import { SIMILAR_BUSINESSES_QUERY_KEY } from "../useSimilarBusinesses";

jest.mock("../../api/exploreBusiness.service", () => ({
  pocketBusiness: jest.fn(),
  removeBusinessFromPocket: jest.fn(),
}));
jest.mock("@/features/pockets/api/pockets.service", () => ({
  getPocketCollections: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn().mockResolvedValue("test-installation"),
}));

const initialAuthState = useAuthStore.getState();
const detailKey = ["explore-business-detail", 42] as const;
const flatKeys = [
  ["explore-new-businesses"],
  DISCOVERY_FEED_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
] as const;
const infiniteKeys = [
  [...DISCOVERY_RESULTS_QUERY_KEY, "criteria"],
  [...EXPLORE_COLLECTIONS_QUERY_KEY, "hidden-gems", null, [], null],
] as const;
const similarKeys = [
  [...SIMILAR_BUSINESSES_QUERY_KEY, 7],
  [...SIMILAR_BUSINESSES_QUERY_KEY, 9],
] as const;
const businessKeys = [detailKey, ...flatKeys, ...infiniteKeys, ...similarKeys];
const ownerKey = pocketCollectionsQueryKey(1);
const otherOwnerKey = pocketCollectionsQueryKey(2);
const unavailableOwnerKey = pocketCollectionsQueryKey(null);
const operations = [
  { operation: "save", isPocketed: false },
  { operation: "unsave", isPocketed: true },
];
const saveSuccess: Awaited<ReturnType<typeof pocketBusiness>> = {
  success: true,
  message: "Saved.",
  data: { id: 100, business_id: 42, is_pocketed: true },
};
const unsaveSuccess: Awaited<ReturnType<typeof removeBusinessFromPocket>> = {
  success: true,
  message: "Removed.",
  data: { business_id: 42, is_pocketed: false },
};
const apiError: ApiError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "Offline",
};

function user(id: number): User {
  return {
    id,
    first_name: "Pocket",
    last_name: "Explorer",
    email: `pocket-${id}@example.com`,
    gender: null,
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  };
}

function business(id: number, isPocketed: boolean): ExploreBusiness {
  return {
    id,
    business_name: `Business ${id}`,
    cover_photo_url: null,
    display_cover_photo_url: null,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: isPocketed,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 8, name: "Cafe" },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
  };
}

function collectionPage(
  count: number,
  ownerId = 1,
): PocketCollectionListResponse {
  return {
    items: [
      {
        id: ownerId * 10,
        name: "Favorites",
        is_default: true,
        business_count: count,
        created_at: "2026-10-19T02:00:00Z",
        updated_at: "2026-10-19T02:00:00Z",
      },
    ],
    pagination: {
      page: 1,
      page_size: 10,
      total_items: 1,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    },
  };
}

function collectionData(
  count: number,
  ownerId = 1,
): InfiniteData<PocketCollectionListResponse> {
  return { pages: [collectionPage(count, ownerId)], pageParams: [1] };
}

function pendingResponse<T>() {
  let resolve!: (response: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("legacy Pocket collection invalidation", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.mocked(pocketBusiness).mockReset().mockResolvedValue(saveSuccess);
    jest
      .mocked(removeBusinessFromPocket)
      .mockReset()
      .mockResolvedValue(unsaveSuccess);
    jest
      .mocked(getPocketCollections)
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Success.",
        data: collectionPage(4),
      });
    useAuthStore.setState({
      user: user(1),
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    client.setQueryData(ownerKey, collectionData(3));
    client.setQueryData(otherOwnerKey, collectionData(8, 2));
    client.setQueryData(unavailableOwnerKey, collectionData(0));
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState(initialAuthState);
    jest.restoreAllMocks();
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  function seedBusinessCaches(isPocketed: boolean) {
    const data: ExploreBusinessListResponse = {
      items: [business(7, false), business(42, isPocketed), business(9, false)],
      pagination: { ...collectionPage(0).pagination, total_items: 3 },
    };
    client.setQueryData(detailKey, business(42, isPocketed));
    for (const key of flatKeys) client.setQueryData(key, data);
    for (const key of infiniteKeys) {
      client.setQueryData(key, { pages: [data], pageParams: [1] });
    }
    for (const key of similarKeys) client.setQueryData(key, data.items);
  }

  function expectBusinessState(isPocketed: boolean) {
    expect(client.getQueryData<ExploreBusiness>(detailKey)?.is_pocketed).toBe(
      isPocketed,
    );
    const lists = [
      ...flatKeys.map(
        (key) => client.getQueryData<ExploreBusinessListResponse>(key)?.items,
      ),
      ...infiniteKeys.map((key) =>
        client
          .getQueryData<InfiniteData<ExploreBusinessListResponse>>(key)
          ?.pages.flatMap((page) => page.items),
      ),
      ...similarKeys.map((key) => client.getQueryData<ExploreBusiness[]>(key)),
    ];
    for (const items of lists) {
      expect(items?.map((item) => item.id)).toEqual([7, 42, 9]);
      expect(items?.find((item) => item.id === 42)?.is_pocketed).toBe(
        isPocketed,
      );
      expect(
        items
          ?.filter((item) => item.id !== 42)
          .every((item) => !item.is_pocketed),
      ).toBe(true);
    }
  }

  it.each(operations)(
    "invalidates only the initiating owner's collections after a successful $operation",
    async ({ isPocketed }) => {
      seedBusinessCaches(isPocketed);
      const before = client.getQueryData(ownerKey);
      const otherBefore = client.getQueryData(otherOwnerKey);
      const { result } = await renderHook(
        () => useBusinessPocket({ businessId: 42 }),
        { wrapper: Wrapper },
      );

      await act(async () => {
        await result.current.pocket({ isPocketed });
      });

      const request = isPocketed ? removeBusinessFromPocket : pocketBusiness;
      const unusedRequest = isPocketed
        ? pocketBusiness
        : removeBusinessFromPocket;
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(42);
      expect(unusedRequest).not.toHaveBeenCalled();
      expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(otherOwnerKey)?.isInvalidated).toBe(false);
      expect(client.getQueryState(unavailableOwnerKey)?.isInvalidated).toBe(
        false,
      );
      expect(client.getQueryData(ownerKey)).toBe(before);
      expect(client.getQueryData(otherOwnerKey)).toBe(otherBefore);
      expect(getPocketCollections).not.toHaveBeenCalled();
      expectBusinessState(!isPocketed);
      for (const key of [detailKey, ...flatKeys.slice(0, 2)]) {
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      }
      expect(
        client.getQueryState(RECOMMENDATIONS_QUERY_KEY)?.isInvalidated,
      ).toBe(false);
    },
  );

  it.each(operations)(
    "rolls back business caches and still invalidates the owner's collections after a failed $operation",
    async ({ isPocketed }) => {
      seedBusinessCaches(isPocketed);
      const before = businessKeys.map((key) => client.getQueryData(key));
      const collectionBefore = client.getQueryData(ownerKey);
      const request = isPocketed
        ? jest.mocked(removeBusinessFromPocket)
        : jest.mocked(pocketBusiness);
      request.mockResolvedValue(apiError);
      const { result } = await renderHook(
        () => useBusinessPocket({ businessId: 42 }),
        { wrapper: Wrapper },
      );

      await act(async () => {
        await expect(result.current.pocket({ isPocketed })).rejects.toBe(
          apiError,
        );
      });

      businessKeys.forEach((key, index) =>
        expect(client.getQueryData(key)).toEqual(before[index]),
      );
      expectBusinessState(isPocketed);
      expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(otherOwnerKey)?.isInvalidated).toBe(false);
      expect(client.getQueryData(ownerKey)).toBe(collectionBefore);
      expect(getPocketCollections).not.toHaveBeenCalled();
    },
  );

  it("keeps immediate optimistic business updates while collection counts wait for settlement", async () => {
    seedBusinessCaches(false);
    const response =
      pendingResponse<Awaited<ReturnType<typeof pocketBusiness>>>();
    jest.mocked(pocketBusiness).mockReturnValue(response.promise);
    const before = client.getQueryData(ownerKey);
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      { wrapper: Wrapper },
    );
    let pending!: Promise<unknown>;

    await act(async () => {
      pending = result.current.pocket({ isPocketed: false });
    });
    await waitFor(() => expect(pocketBusiness).toHaveBeenCalledTimes(1));

    expectBusinessState(true);
    expect(client.getQueryData(ownerKey)).toBe(before);
    expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(false);

    await act(async () => {
      response.resolve(saveSuccess);
      await pending;
    });

    expect(client.getQueryData(ownerKey)).toBe(before);
    expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
  });

  it("refetches an active collection list once and adopts its server counts", async () => {
    const { result } = await renderHook(
      () => ({
        business: useBusinessPocket({ businessId: 42 }),
        collections: usePocketCollections(),
      }),
      { wrapper: Wrapper },
    );
    expect(getPocketCollections).not.toHaveBeenCalled();
    expect(result.current.collections.collections[0].business_count).toBe(3);

    await act(async () => {
      await result.current.business.pocket({ isPocketed: false });
    });

    await waitFor(() =>
      expect(result.current.collections.collections[0].business_count).toBe(4),
    );
    expect(getPocketCollections).toHaveBeenCalledTimes(1);
    expect(getPocketCollections).toHaveBeenCalledWith(1);
    expect(client.getQueryState(otherOwnerKey)?.isInvalidated).toBe(false);
  });

  it.each(["success", "failure"])(
    "retains the initiating owner through an account switch on %s without refetching the old owner",
    async (outcome) => {
      const response =
        pendingResponse<Awaited<ReturnType<typeof pocketBusiness>>>();
      jest.mocked(pocketBusiness).mockReturnValue(response.promise);
      const oldFetch = jest.fn(async () => collectionData(4));
      const otherFetch = jest.fn(async () => collectionData(9, 2));
      // Keep both caches observed to verify the refetch guard during an account transition.
      const oldObserver = new QueryObserver(client, {
        queryKey: ownerKey,
        queryFn: oldFetch,
      });
      const otherObserver = new QueryObserver(client, {
        queryKey: otherOwnerKey,
        queryFn: otherFetch,
      });
      const unsubscribeOld = oldObserver.subscribe(() => {});
      const unsubscribeOther = otherObserver.subscribe(() => {});
      const before = client.getQueryData(ownerKey);
      const otherBefore = client.getQueryData(otherOwnerKey);

      try {
        const { result, rerender } = await renderHook(
          () => useBusinessPocket({ businessId: 42 }),
          { wrapper: Wrapper },
        );
        let pending!: Promise<unknown>;
        await act(async () => {
          pending = result.current
            .pocket({ isPocketed: false })
            .catch((error: unknown) => error);
        });
        await waitFor(() => expect(pocketBusiness).toHaveBeenCalledTimes(1));
        await act(async () => {
          useAuthStore.getState().setUser(user(2));
        });
        await rerender(undefined);
        await act(async () => {
          response.resolve(outcome === "success" ? saveSuccess : apiError);
          await pending;
        });

        expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
        expect(client.getQueryState(otherOwnerKey)?.isInvalidated).toBe(false);
        expect(client.getQueryData(ownerKey)).toBe(before);
        expect(client.getQueryData(otherOwnerKey)).toBe(otherBefore);
        expect(oldFetch).not.toHaveBeenCalled();
        expect(otherFetch).not.toHaveBeenCalled();
        expect(getPocketCollections).not.toHaveBeenCalled();
      } finally {
        unsubscribeOld();
        unsubscribeOther();
      }
    },
  );

  it("captures ownership before awaiting optimistic cache cancellation", async () => {
    const cancellation = pendingResponse<void>();
    jest
      .spyOn(client, "cancelQueries")
      .mockReturnValueOnce(cancellation.promise);
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      { wrapper: Wrapper },
    );
    let pending!: Promise<unknown>;

    await act(async () => {
      pending = result.current.pocket({ isPocketed: false });
    });
    expect(pocketBusiness).not.toHaveBeenCalled();
    await act(async () => {
      useAuthStore.getState().setUser(user(2));
      cancellation.resolve();
      await pending;
    });

    expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherOwnerKey)?.isInvalidated).toBe(false);
    expect(pocketBusiness).toHaveBeenCalledWith(42);
  });

  it("does not recreate private collection caches after sign-out clears the query client", async () => {
    const response =
      pendingResponse<Awaited<ReturnType<typeof pocketBusiness>>>();
    jest.mocked(pocketBusiness).mockReturnValue(response.promise);
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      { wrapper: Wrapper },
    );
    let pending!: Promise<unknown>;

    await act(async () => {
      pending = result.current.pocket({ isPocketed: false });
    });
    await waitFor(() => expect(pocketBusiness).toHaveBeenCalledTimes(1));
    await act(async () => {
      useAuthStore.getState().clearUser();
      client.clear();
      response.resolve(saveSuccess);
      await pending;
    });

    expect(client.getQueryState(ownerKey)).toBeUndefined();
    expect(client.getQueryState(otherOwnerKey)).toBeUndefined();
    expect(client.getQueryState(unavailableOwnerKey)).toBeUndefined();
    expect(getPocketCollections).not.toHaveBeenCalled();
  });

  it("skips collection invalidation when there was no initiating user", async () => {
    useAuthStore.getState().clearUser();
    jest.mocked(pocketBusiness).mockResolvedValue(apiError);
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await expect(result.current.pocket({ isPocketed: false })).rejects.toBe(
        apiError,
      );
    });

    for (const key of [ownerKey, otherOwnerKey, unavailableOwnerKey]) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
    expect(pocketBusiness).toHaveBeenCalledWith(42);
    expect(getPocketCollections).not.toHaveBeenCalled();
  });
});
