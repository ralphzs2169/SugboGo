import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { recentBusinessDetails } from "../../services/recentBusinessDetails.service";
import { resolveBusinessProfilePreview } from "../../utils/businessProfilePreview";
import useBusinessProfilePreview from "../useBusinessProfilePreview";
import { exploreBusinessDetailKey } from "../reviewQueryKeys";

let mockApiScope = "https://api.example.test";
jest.mock("@/shared/query/queryPersistencePolicies", () => ({
  ...jest.requireActual("@/shared/query/queryPersistencePolicies"),
  getQueryPersistenceApiScope: () => mockApiScope,
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

let client: QueryClient;
const business = businessFixture();
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  mockApiScope = "https://api.example.test";
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});
afterEach(async () => {
  client.clear();
  await recentBusinessDetails.flush();
});

it.each([
  ["discovery", ["explore-discovery"], { items: [business] }],
  ["new", ["explore-new-businesses"], { items: [business] }],
  ["For You", ["explore-recommendations"], { items: [business] }],
  ["Open Now", ["explore-open-now", 10, 124], [business]],
  ["Similar Places", ["similar-businesses", 99], [business]],
  ["map directory", ["map-discovery-directory", "all"], [business]],
  ["map selection", ["map-discovery-directory", "business", 21], [business]],
  [
    "search",
    ["explore-discovery-results", "cafe", null, [], null],
    { pages: [{ items: [] }, { items: [business] }], pageParams: [1, 2] },
  ],
  [
    "Explore collection",
    ["explore-collections", "hidden-gems", null, [], null],
    { pages: [{ items: [business] }], pageParams: [1] },
  ],
  [
    "owned Pocket collection",
    ["pockets", 7, "collections", 2, "businesses"],
    { pages: [{ items: [business] }], pageParams: [1] },
  ],
])("reads %s identity without copying live fields", (_label, key, data) => {
  client.setQueryData(key as unknown[], data);
  expect(resolveBusinessProfilePreview(client, 21, 7)).toEqual({
    id: 21,
    business_name: business.business_name,
    display_cover_photo_url: business.display_cover_photo_url,
    cluster: business.cluster,
    category: business.category,
  });
  expect(client.getQueryData(exploreBusinessDetailKey(21))).toBeUndefined();
});

it("chooses the newest matching listing, ignores unrelated/detail/other-account caches", () => {
  client.setQueryData(
    ["explore-discovery"],
    { items: [business] },
    { updatedAt: 1 },
  );
  client.setQueryData(
    ["similar-businesses", 99],
    [{ ...business, business_name: "New listing name" }],
    { updatedAt: 2 },
  );
  client.setQueryData(["unrelated"], [{ ...business, business_name: "Wrong" }]);
  client.setQueryData(["pockets", 8, "collections", 2, "businesses"], {
    pages: [{ items: [{ ...business, business_name: "Other owner" }] }],
  });
  client.setQueryData(exploreBusinessDetailKey(21), {
    ...business,
    business_name: "Detail must be resolved separately",
  });
  expect(resolveBusinessProfilePreview(client, 21, 7)?.business_name).toBe(
    "New listing name",
  );
  expect(resolveBusinessProfilePreview(client, 22, 7)).toBeNull();
});

it("rejects invalid IDs and malformed identity, without hiding a valid older listing", () => {
  client.setQueryData(
    ["explore-discovery"],
    { items: [business] },
    { updatedAt: 1 },
  );
  client.setQueryData(
    ["similar-businesses", 99],
    [{ id: 21, business_name: "Incomplete", cluster: null }],
    { updatedAt: 2 },
  );
  expect(resolveBusinessProfilePreview(client, 21, 7)?.business_name).toBe(
    business.business_name,
  );
  for (const id of [0, -1, NaN, 21.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(resolveBusinessProfilePreview(client, id, 7)).toBeNull();
  }
});

it("does not scan listing items again on ordinary renders and never shows A for B", async () => {
  client.setQueryData(["explore-discovery"], { items: [business] });
  const scans = jest.spyOn(client.getQueryCache(), "findAll");
  const view = await renderHook(
    ({ id, enabled }) => useBusinessProfilePreview(id, enabled),
    { wrapper: Wrapper, initialProps: { id: 21, enabled: true } },
  );
  expect(view.result.current?.id).toBe(21);
  const count = scans.mock.calls.length;
  await view.rerender({ id: 21, enabled: true });
  expect(scans).toHaveBeenCalledTimes(count);
  await view.rerender({ id: 22, enabled: true });
  expect(view.result.current).toBeNull();
  await view.rerender({ id: 21, enabled: false });
  expect(view.result.current).toBeNull();
  scans.mockRestore();
});

it.each(["account", "generation", "API scope", "logout"])(
  "revokes a mounted preview on %s changes",
  async (change) => {
    client.setQueryData(["explore-discovery"], { items: [business] });
    const view = await renderHook(() => useBusinessProfilePreview(21, true), {
      wrapper: Wrapper,
    });
    expect(view.result.current?.id).toBe(21);
    await act(async () => {
      if (change === "account")
        useAuthStore.setState({ user: { id: 8 } as never });
      if (change === "generation") beginAuthSession();
      if (change === "API scope") mockApiScope = "https://other.example.test";
      if (change === "logout")
        useAuthStore.setState({ isAuthenticated: false });
    });
    await view.rerender({});
    expect(view.result.current).toBeNull();
  },
);

it("returns no preview when no listing exists or the session is unauthorized", async () => {
  const view = await renderHook(() => useBusinessProfilePreview(21, true), {
    wrapper: Wrapper,
  });
  expect(view.result.current).toBeNull();
  await view.unmount();
  client.setQueryData(["explore-discovery"], { items: [business] });
  useAuthStore.setState({ isAuthenticated: false });
  const unauthorized = await renderHook(
    () => useBusinessProfilePreview(21, true),
    {
      wrapper: Wrapper,
    },
  );
  expect(unauthorized.result.current).toBeNull();
});
