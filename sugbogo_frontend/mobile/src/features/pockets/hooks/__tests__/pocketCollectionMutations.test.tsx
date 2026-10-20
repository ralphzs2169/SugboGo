import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import type { ApiError } from "@/shared/types/apiResponse.types";
import {
  createPocketCollection,
  renamePocketCollection,
  deletePocketCollection,
  removePocketCollectionBusiness,
} from "../../api/pockets.service";
import type { PocketCollection } from "../../types/pockets.types";
import {
  businessPocketMembershipsQueryKey,
  pocketCollectionBusinessesQueryKey,
  pocketCollectionQueryKey,
  pocketCollectionsQueryKey,
} from "../pocketQueryKeys";
import {
  useCreatePocketCollection,
  useRenamePocketCollection,
  useDeletePocketCollection,
  useRemovePocketBusiness,
} from "../usePocketCollectionMutations";

jest.mock("../../api/pockets.service", () => ({
  createPocketCollection: jest.fn(),
  renamePocketCollection: jest.fn(),
  deletePocketCollection: jest.fn(),
  removePocketCollectionBusiness: jest.fn(),
}));
const initialAuth = useAuthStore.getState();
const user: User = {
  id: 1,
  first_name: "Pocket",
  last_name: "Explorer",
  email: "pocket@example.com",
  gender: null,
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};
const collection: PocketCollection = {
  id: 30,
  name: "Coffee",
  is_default: false,
  business_count: 7,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
};
const failure: ApiError = {
  success: false,
  code: "VALIDATION_ERROR",
  message: "Invalid Pocket.",
  errors: { name: ["You already have a Pocket with this name."] },
};
const ok = <T,>(data: T) => ({
  success: true as const,
  message: "Success.",
  data,
});

describe("owned Pocket collection mutations", () => {
  let client: QueryClient;
  let stops: (() => void)[];
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    jest
      .mocked(createPocketCollection)
      .mockReset()
      .mockResolvedValue(ok({ ...collection, business_count: 0 }));
    jest
      .mocked(renamePocketCollection)
      .mockReset()
      .mockResolvedValue(ok({ ...collection, name: "Renamed" }));
    jest
      .mocked(deletePocketCollection)
      .mockReset()
      .mockResolvedValue(ok({ id: 30 }));
    jest
      .mocked(removePocketCollectionBusiness)
      .mockReset()
      .mockResolvedValue(
        ok({ business_id: 42, pocket_ids: [20], is_pocketed: true }),
      );
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    client.setQueryData(pocketCollectionsQueryKey(2), { untouched: true });
    stops = [];
  });
  afterEach(async () => {
    await cleanup();
    stops.forEach((stop) => stop());
    client.clear();
    useAuthStore.setState(initialAuth);
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function useActions() {
    return {
      create: useCreatePocketCollection(),
      rename: useRenamePocketCollection(),
      delete: useDeletePocketCollection(),
      remove: useRemovePocketBusiness(),
    };
  }
  const kinds = ["create", "rename", "delete", "remove"] as const;
  function submit(
    actions: ReturnType<typeof useActions>,
    kind: (typeof kinds)[number],
  ) {
    if (kind === "create") return actions.create.createCollection(" Coffee ");
    if (kind === "rename")
      return actions.rename.renameCollection({ collection, name: "Renamed" });
    if (kind === "delete") return actions.delete.deleteCollection(collection);
    return actions.remove.removeBusiness({ collectionId: 30, businessId: 42 });
  }
  const api = {
    create: createPocketCollection,
    rename: renamePocketCollection,
    delete: deletePocketCollection,
    remove: removePocketCollectionBusiness,
  };

  it("creates actual metadata and invalidates only the initiating owner's collection prefix", async () => {
    client.setQueryData(pocketCollectionsQueryKey(1), { items: [] });
    const { result } = await renderHook(useActions, { wrapper: Wrapper });
    await act(async () => {
      expect(await submit(result.current, "create")).toEqual({
        ...collection,
        business_count: 0,
      });
    });
    expect(createPocketCollection).toHaveBeenCalledWith(" Coffee ");
    expect(client.getQueryData(pocketCollectionQueryKey(1, 30))).toEqual({
      ...collection,
      business_count: 0,
    });
    expect(
      client.getQueryState(pocketCollectionsQueryKey(1))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
    ).toBe(false);
  });
  it("preserves server metadata and business counts when renaming", async () => {
    const { result } = await renderHook(useActions, { wrapper: Wrapper });
    await act(async () => {
      await submit(result.current, "rename");
    });
    expect(renamePocketCollection).toHaveBeenCalledWith(30, "Renamed");
    expect(client.getQueryData(pocketCollectionQueryKey(1, 30))).toEqual({
      ...collection,
      name: "Renamed",
    });
  });
  it.each(["rename", "delete"] as const)(
    "blocks %s of Favorites before an API request",
    async (kind) => {
      const { result } = await renderHook(useActions, { wrapper: Wrapper });
      await act(async () => {
        const favorites = { ...collection, is_default: true };
        const writing =
          kind === "rename"
            ? result.current.rename.renameCollection({
                collection: favorites,
                name: "Other",
              })
            : result.current.delete.deleteCollection(favorites);
        await expect(writing).rejects.toThrow("Favorites");
      });
      expect(api[kind]).not.toHaveBeenCalled();
    },
  );
  it.each([[20], []])(
    "removes one membership using the returned remaining IDs %j",
    async (...ids) => {
      const remaining = ids as number[];
      jest.mocked(removePocketCollectionBusiness).mockResolvedValue(
        ok({
          business_id: 42,
          pocket_ids: remaining,
          is_pocketed: remaining.length > 0,
        }),
      );
      const feed = {
        items: [
          { id: 7, is_pocketed: true },
          { id: 42, is_pocketed: true },
        ],
      };
      client.setQueryData(RECOMMENDATIONS_QUERY_KEY, feed);
      client.setQueryData(pocketCollectionQueryKey(1, 30), collection);
      client.setQueryData(pocketCollectionBusinessesQueryKey(1, 30), {
        pages: [feed],
        pageParams: [1],
      });
      const { result } = await renderHook(useActions, { wrapper: Wrapper });
      await act(async () => {
        await submit(result.current, "remove");
      });
      expect(removePocketCollectionBusiness).toHaveBeenCalledWith(30, 42);
      expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual({
        items: [
          feed.items[0],
          { ...feed.items[1], is_pocketed: remaining.length > 0 },
        ],
      });
      expect(
        client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
      ).toEqual({
        business_id: 42,
        pocket_ids: remaining,
        is_pocketed: remaining.length > 0,
      });
      expect(client.getQueryData(pocketCollectionQueryKey(1, 30))).toEqual(
        collection,
      );
      expect(
        client.getQueryState(pocketCollectionBusinessesQueryKey(1, 30))
          ?.isInvalidated,
      ).toBe(true);
    },
  );
  it("deletes without refetching deleted detail, while refreshing lists and saved flags", async () => {
    client.setQueryData(pocketCollectionQueryKey(1, 30), collection);
    const readDeleted = jest.fn();
    const detail = new QueryObserver(client, {
      queryKey: pocketCollectionQueryKey(1, 30),
      queryFn: readDeleted,
      staleTime: Infinity,
    });
    stops.push(detail.subscribe(() => {}));
    client.setQueryData(pocketCollectionsQueryKey(1), { items: [collection] });
    const readList = jest.fn().mockResolvedValue({ items: [] });
    const list = new QueryObserver(client, {
      queryKey: pocketCollectionsQueryKey(1),
      queryFn: readList,
      staleTime: Infinity,
    });
    stops.push(list.subscribe(() => {}));
    client.setQueryData(["explore-business-detail", 42], {
      id: 42,
      is_pocketed: true,
    });
    const readBusiness = jest
      .fn()
      .mockResolvedValue({ id: 42, is_pocketed: false });
    const business = new QueryObserver(client, {
      queryKey: ["explore-business-detail", 42],
      queryFn: readBusiness,
      staleTime: Infinity,
    });
    stops.push(business.subscribe(() => {}));
    const { result } = await renderHook(useActions, { wrapper: Wrapper });
    await act(async () => {
      await submit(result.current, "delete");
    });
    expect(deletePocketCollection).toHaveBeenCalledWith(30);
    expect(readDeleted).not.toHaveBeenCalled();
    expect(readList).toHaveBeenCalledTimes(1);
    expect(readBusiness).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
      id: 42,
      is_pocketed: false,
    });
    expect(
      client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
    ).toBe(false);
  });
  it.each(kinds)(
    "preserves structured %s errors without optimistic removals",
    async (kind) => {
      jest.mocked(api[kind]).mockResolvedValue(failure);
      client.setQueryData(pocketCollectionQueryKey(1, 30), collection);
      client.setQueryData(["explore-business-detail", 42], {
        id: 42,
        is_pocketed: true,
      });
      const { result } = await renderHook(useActions, { wrapper: Wrapper });
      await act(async () => {
        await expect(submit(result.current, kind)).rejects.toEqual(failure);
      });
      expect(client.getQueryData(pocketCollectionQueryKey(1, 30))).toEqual(
        collection,
      );
      expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
        id: 42,
        is_pocketed: true,
      });
    },
  );
  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user, isAuthenticated: true, isLoading: true },
  ])("guards unavailable authentication %#", async (state) => {
    useAuthStore.setState(state);
    const { result } = await renderHook(useActions, { wrapper: Wrapper });
    await act(async () => {
      for (const kind of kinds)
        await expect(submit(result.current, kind)).rejects.toThrow("Sign in");
    });
    for (const request of Object.values(api))
      expect(request).not.toHaveBeenCalled();
  });
  it("blocks duplicate pending creation", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof createPocketCollection>>,
    ) => void;
    jest.mocked(createPocketCollection).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = await renderHook(useActions, { wrapper: Wrapper });
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = submit(result.current, "create");
      await expect(submit(result.current, "create")).rejects.toThrow(
        "already saving",
      );
    });
    await act(async () => {
      resolve(ok(collection));
      await pending;
    });
    expect(createPocketCollection).toHaveBeenCalledTimes(1);
  });
  it.each(kinds)(
    "ignores a late %s response after switching accounts",
    async (kind) => {
      let resolve!: (value: unknown) => void;
      jest.mocked(api[kind]).mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }) as never,
      );
      const { result } = await renderHook(useActions, { wrapper: Wrapper });
      let pending!: Promise<unknown>;
      await act(async () => {
        pending = submit(result.current, kind).catch((error: unknown) => error);
      });
      await act(async () => {
        beginAuthSession();
        useAuthStore.setState({ user: { ...user, id: 2 } });
        client.clear();
        client.setQueryData(pocketCollectionsQueryKey(2), { untouched: true });
        client.setQueryData(["explore-business-detail", 42], {
          id: 42,
          is_pocketed: false,
        });
      });
      await act(async () => {
        resolve(
          kind === "delete"
            ? ok({ id: 30 })
            : kind === "remove"
              ? ok({ business_id: 42, pocket_ids: [20], is_pocketed: true })
              : ok(collection),
        );
        expect(await pending).toBeInstanceOf(Error);
      });
      expect(
        client.getQueryData(pocketCollectionQueryKey(1, 30)),
      ).toBeUndefined();
      expect(
        client.getQueryState(pocketCollectionsQueryKey(2))?.isInvalidated,
      ).toBe(false);
      expect(client.getQueryData(["explore-business-detail", 42])).toEqual({
        id: 42,
        is_pocketed: false,
      });
    },
  );
});
