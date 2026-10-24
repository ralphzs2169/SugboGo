import { act, render, waitFor } from "@testing-library/react-native";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import { createQueryPersistence } from "@/shared/query/queryPersistence.service";
import {
  QUERY_PERSISTENCE_LIMITS,
  QUERY_PERSISTENCE_POLICIES,
  serializedBytes,
} from "@/shared/query/queryPersistencePolicies";
import { getNewBusinesses } from "../../api/exploreBusiness.service";
import NewBusinessesSection from "../../components/new-businesses/NewBusinessesSection";
import { getExploreCollectionQueryKey } from "../../hooks/useExploreCollection";
import { getDiscoveryResultsQueryKey } from "../../hooks/useDiscoveryResults";
import { exploreBusinessDetailKey } from "../../hooks/reviewQueryKeys";
import { configureExploreHomepageQueryRetention } from "../exploreHomepageQueryDefaults";
import * as keys from "../../constants/exploreHomepageQueries";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../api/exploreBusiness.service", () => ({
  getNewBusinesses: jest.fn(),
}));
jest.mock("@/shared/components/ErrorState", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockError() {
    return <Text>Retry failed section</Text>;
  };
});
jest.mock("../../components/ExploreSectionHeader", () => () => null);
jest.mock(
  "../../components/business-carousel/ExploreBusinessCarouselSkeleton",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function MockSkeleton() {
      return <Text>Loading cards</Text>;
    };
  },
);
jest.mock(
  "../../components/business-carousel/ExploreBusinessCarouselSection",
  () => {
    const { Text, View } = jest.requireActual("react-native");
    return function MockCarousel({
      businesses,
    }: {
      businesses: { id: number; business_name: string }[];
    }) {
      return (
        <View>
          {businesses.map((business) => (
            <Text key={business.id}>{business.business_name}</Text>
          ))}
        </View>
      );
    };
  },
);

const feedKeys = [
  keys.DISCOVERY_FEED_QUERY_KEY,
  keys.NEW_BUSINESSES_QUERY_KEY,
  keys.RECOMMENDATIONS_QUERY_KEY,
];
const metadataKeys = [
  keys.DISCOVERY_SHORTCUTS_QUERY_KEY,
  keys.EXPLORE_SPECIALTIES_QUERY_KEY,
  keys.EXPLORE_FILTER_OPTIONS_QUERY_KEY,
];
const cluster = { id: 1, name: "Food", icon: "food" };
const specialty = { id: 1, name: "Coffee", color: "blue", icon: "coffee" };

function feed(length = 1, name = "Previously loaded cafe") {
  return {
    items: Array.from({ length }, (_, index) => ({
      id: index + 1,
      business_name: name,
      cover_photo_url: "https://example.test/cover.jpg",
      display_cover_photo_url: null,
      review_count: 2,
      overall_vibe: "mostly_positive",
      is_pocketed: true,
      cluster,
      category: { id: 1, name: "Cafe" },
      specialty_tags: [{ ...specialty, is_vouched: true, vouch_count: 3 }],
      location: {
        address: "Street",
        city: "Cebu",
        province: "Cebu",
        latitude: 10,
        longitude: 123,
      },
      recommendation_reason: { type: "category", id: 1, label: "Cafe" },
      restricted_unknown_field: "must not persist",
    })),
    pagination: {
      page: 1,
      page_size: 10,
      total_items: length,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    },
  };
}

const metadata = [
  [{ id: 1, title: "Food", subtitle: "Nearby", business_count: 3, cluster }],
  [{ ...specialty, business_count: 3 }],
  {
    clusters: [cluster],
    categories: [{ id: 1, name: "Cafe", cluster_id: 1 }],
    specialty_tags: [specialty],
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let clock: number;
let apiScope: string;
let stored: string | null;
const cleanup: (() => void)[] = [];
const clients: QueryClient[] = [];
let storage: {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

function context() {
  const runtime = createQueryPersistence({
    storage,
    now: () => clock,
    getApiScope: () => apiScope,
    throttleTimeMs: 0,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  configureExploreHomepageQueryRetention(client);
  const session = runtime.openSession(client);
  const stop = session.track();
  cleanup.push(() => {
    stop();
    runtime.dispose();
    client.clear();
  });
  return {
    runtime,
    client,
    session,
    fetch: (key: readonly unknown[], data: unknown) =>
      client.fetchQuery({
        queryKey: key,
        queryFn: async () => data,
        staleTime: 0,
      }),
    save: () =>
      persistQueryClientSave({
        queryClient: client,
        ...session.persistOptions,
      }),
    restore: () =>
      persistQueryClientRestore({
        queryClient: client,
        ...session.persistOptions,
      }),
  };
}

async function seed(
  key = keys.NEW_BUSINESSES_QUERY_KEY,
  data: unknown = feed(),
) {
  const original = context();
  await original.fetch(key, data);
  await original.save();
  // Recreate the process without a logout, preserving only the storage adapter.
  cleanup.splice(0).forEach((stop) => stop());
}

beforeEach(() => {
  clock = 100_000;
  apiScope = "https://api.test/api";
  stored = null;
  storage = {
    getItem: jest.fn(async () => stored),
    setItem: jest.fn(async (_key: string, json: string) => {
      stored = json;
    }),
    removeItem: jest.fn(async () => {
      stored = null;
    }),
  };
  jest.spyOn(Date, "now").mockImplementation(() => clock);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  beginAuthSession("restore");
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  onlineManager.setOnline(true);
  jest.mocked(getNewBusinesses).mockReset();
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.cancelQueries()));
  cleanup.splice(0).forEach((stop) => stop());
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

it.each(feedKeys.map((key) => [key[0], key] as const))(
  "persists only ten first-page businesses for %s",
  async (_, key) => {
    const first = context();
    const data = feed(14);
    await first.fetch(key, data);
    await first.save();
    expect(first.client.getQueryData(key)).toEqual(data);
    const entry = JSON.parse(stored!).entries[0];
    expect(entry.data.items).toHaveLength(10);
    expect(entry.data.items[0].is_pocketed).toBe(true);
    expect(entry.data.items[0].specialty_tags[0].is_vouched).toBe(true);
    expect(entry.data.items[0].restricted_unknown_field).toBeUndefined();
    expect(entry.data.items[0].cover_photo_url).toBe(
      data.items[0].cover_photo_url,
    );
    cleanup.splice(0).forEach((stop) => stop());
    const next = context();
    await next.restore();
    expect(
      next.client.getQueryData<{ items: unknown[] }>(key)?.items,
    ).toHaveLength(10);
  },
);

it.each([true, false, undefined])(
  "preserves recommendation personalization state %s across cache restore",
  async (isPersonalized) => {
    const original = feed();
    if (isPersonalized !== undefined) {
      Object.assign(original, { is_personalized: isPersonalized });
    }
    await seed(keys.RECOMMENDATIONS_QUERY_KEY, original);
    const restored = context();
    await restored.restore();

    const data = restored.client.getQueryData<{ is_personalized?: boolean }>(
      keys.RECOMMENDATIONS_QUERY_KEY,
    );
    expect(data).toBeDefined();
    expect(data?.is_personalized).toBe(isPersonalized);
  },
);

it.each(
  metadataKeys.map((key, index) => [key[0], key, metadata[index]] as const),
)("restores approved %s metadata", async (_, key, data) => {
  const first = context();
  await first.fetch(key, data);
  await first.save();
  cleanup.splice(0).forEach((stop) => stop());
  const next = context();
  await next.restore();
  expect(next.client.getQueryData(key)).toEqual(data);
});

it("denies search, collections, details, map, Community, inbox and merchant queries", () => {
  const scope = { ownerId: 7, apiScope };
  for (const key of [
    getDiscoveryResultsQueryKey({
      search: "coffee",
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    }),
    getExploreCollectionQueryKey("hidden-gems", {
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    }),
    exploreBusinessDetailKey(1),
    ["community-reviews"],
    ["notifications"],
    ["merchant-dashboard", 7, "recent-activity"],
    ["explore-map-preview"],
    ["auth"],
    ...feedKeys.map((key) => [...key, { page: 2 }]),
  ]) {
    expect(
      QUERY_PERSISTENCE_POLICIES.some((policy) => policy.matches(key, scope)),
    ).toBe(false);
  }
});

it("rejects page two and skips oversized entries without changing live data", async () => {
  const first = context();
  const data = feed();
  data.pagination.page = 2;
  await first.fetch(keys.NEW_BUSINESSES_QUERY_KEY, data);
  await first.save();
  expect(stored).toBeNull();
  const oversized = feed(1, "x".repeat(QUERY_PERSISTENCE_LIMITS.maxEntryBytes));
  await first.fetch(keys.NEW_BUSINESSES_QUERY_KEY, oversized);
  await first.save();
  expect(stored).toBeNull();
  expect(first.client.getQueryData(keys.NEW_BUSINESSES_QUERY_KEY)).toEqual(
    oversized,
  );
});

it("keeps the existing total byte budget across approved feeds", async () => {
  const first = context();
  for (const key of feedKeys) {
    await first.fetch(key, feed(10, "x".repeat(40_000)));
  }
  for (let index = 0; index < metadataKeys.length; index += 1) {
    await first.fetch(metadataKeys[index], metadata[index]);
  }
  await first.save();
  expect(JSON.parse(stored!).entries).toHaveLength(6);
  expect(serializedBytes(stored!)).toBeLessThanOrEqual(
    QUERY_PERSISTENCE_LIMITS.maxBytes,
  );
});

it("preserves twenty-hour fetch age across restoration and unrelated metadata writes", async () => {
  await seed();
  clock += 20 * 60 * 60 * 1000;
  const restored = context();
  await restored.restore();
  expect(
    restored.client.getQueryState(keys.NEW_BUSINESSES_QUERY_KEY)?.dataUpdatedAt,
  ).toBe(100_000);
  await restored.fetch(keys.DISCOVERY_SHORTCUTS_QUERY_KEY, metadata[0]);
  await restored.save();
  expect(
    JSON.parse(stored!).entries.find(
      (entry: { policyId: string }) =>
        entry.policyId === "explore-new-businesses",
    ).fetchedAt,
  ).toBe(100_000);
  cleanup.splice(0).forEach((stop) => stop());
  clock += 4 * 60 * 60 * 1000;
  const expired = context();
  await expired.restore();
  expect(
    expired.client.getQueryData(keys.NEW_BUSINESSES_QUERY_KEY),
  ).toBeUndefined();
  expect(
    expired.client.getQueryData(keys.DISCOVERY_SHORTCUTS_QUERY_KEY),
  ).toEqual(metadata[0]);
});

it("retains filter controls up to 72 hours independently of homepage feeds", async () => {
  const first = context();
  await first.fetch(keys.EXPLORE_FILTER_OPTIONS_QUERY_KEY, metadata[2]);
  await first.save();
  cleanup.splice(0).forEach((stop) => stop());
  clock += keys.EXPLORE_FILTER_RETENTION_MS - 1;
  const next = context();
  await next.restore();
  expect(
    next.client.getQueryData(keys.EXPLORE_FILTER_OPTIONS_QUERY_KEY),
  ).toEqual(metadata[2]);
  cleanup.splice(0).forEach((stop) => stop());
  clock += 1;
  const expired = context();
  await expired.restore();
  expect(
    expired.client.getQueryData(keys.EXPLORE_FILTER_OPTIONS_QUERY_KEY),
  ).toBeUndefined();
});

it.each(["owner", "API"])(
  "rejects Explore hydration for a mismatched %s",
  async (mismatch) => {
    await seed();
    if (mismatch === "owner")
      useAuthStore.setState({ user: { id: 8 } as never });
    else apiScope = "https://other.test/api";
    const next = context();
    await next.restore();
    expect(
      next.client.getQueryData(keys.NEW_BUSINESSES_QUERY_KEY),
    ).toBeUndefined();
  },
);

it.each(["logout", "expiry", "same-user-relogin"])(
  "revokes Explore persistence on %s",
  async (boundary) => {
    const first = context();
    await first.fetch(keys.NEW_BUSINESSES_QUERY_KEY, feed());
    await first.save();
    if (boundary === "same-user-relogin") beginAuthSession();
    else invalidateAuthSession();
    await first.save();
    await first.runtime.flush();
    expect(stored).toBeNull();
  },
);

it("rejects a delayed Explore write after the same user signs in again", async () => {
  const pending = deferred<void>();
  storage.setItem.mockImplementationOnce(async (_key: string, json: string) => {
    await pending.promise;
    stored = json;
  });
  const first = context();
  await first.fetch(keys.NEW_BUSINESSES_QUERY_KEY, feed());
  const saving = first.save();
  await waitFor(() => expect(storage.setItem).toHaveBeenCalled());
  beginAuthSession();
  pending.resolve();
  await saving;
  await first.runtime.flush();
  expect(stored).toBeNull();
});

it("configures only approved query GC before hydration without changing global freshness", async () => {
  await seed();
  const next = context();
  await next.restore();
  expect(
    next.client
      .getQueryCache()
      .find({ queryKey: keys.NEW_BUSINESSES_QUERY_KEY })?.gcTime,
  ).toBe(keys.EXPLORE_HOMEPAGE_RETENTION_MS);
  expect(
    next.client.getQueryDefaults(keys.EXPLORE_FILTER_OPTIONS_QUERY_KEY).gcTime,
  ).toBe(keys.EXPLORE_FILTER_RETENTION_MS);
  expect(next.client.getQueryDefaults(["community-reviews"])).toEqual({});
  expect(next.client.getDefaultOptions().queries?.gcTime).toBeUndefined();
  expect(
    next.client.getQueryDefaults(keys.NEW_BUSINESSES_QUERY_KEY).staleTime,
  ).toBeUndefined();
});

async function renderRestoredSection() {
  const next = context();
  const screen = await render(
    <QueryPersistenceProvider client={next.client} persistence={next.runtime}>
      <NewBusinessesSection
        impressions={{} as never}
        userLocation={null}
        onBusinessPress={jest.fn()}
      />
    </QueryPersistenceProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("Previously loaded cafe")).toBeTruthy(),
  );
  return { ...next, screen };
}

it("renders hydrated cards offline with no new successful request", async () => {
  await seed();
  clock += 20 * 60 * 60 * 1000;
  onlineManager.setOnline(false);
  const { screen } = await renderRestoredSection();
  expect(getNewBusinesses).not.toHaveBeenCalled();
  expect(screen.queryByText("Loading cards")).toBeNull();
  expect(screen.queryByText("Retry failed section")).toBeNull();
  await screen.unmount();
});

it("keeps hydrated cards while refreshing and after failure, then accepts fresh and empty responses", async () => {
  await seed();
  clock += 20 * 60 * 60 * 1000;
  const refresh = deferred<Awaited<ReturnType<typeof getNewBusinesses>>>();
  jest.mocked(getNewBusinesses).mockImplementationOnce(() => refresh.promise);
  const { client, screen, save } = await renderRestoredSection();
  expect(getNewBusinesses).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Loading cards")).toBeNull();
  await act(async () =>
    refresh.resolve({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    }),
  );
  await waitFor(() =>
    expect(client.getQueryState(keys.NEW_BUSINESSES_QUERY_KEY)?.status).toBe(
      "error",
    ),
  );
  expect(screen.getByText("Previously loaded cafe")).toBeTruthy();
  expect(screen.queryByText("Retry failed section")).toBeNull();
  jest.mocked(getNewBusinesses).mockResolvedValueOnce({
    success: true,
    message: "Loaded",
    data: feed(1, "Fresh cafe") as never,
  });
  await act(async () => {
    await client.refetchQueries({ queryKey: keys.NEW_BUSINESSES_QUERY_KEY });
  });
  await waitFor(() => expect(screen.getByText("Fresh cafe")).toBeTruthy());
  jest.mocked(getNewBusinesses).mockResolvedValueOnce({
    success: true,
    message: "Loaded",
    data: feed(0) as never,
  });
  await act(async () => {
    await client.refetchQueries({ queryKey: keys.NEW_BUSINESSES_QUERY_KEY });
  });
  await waitFor(() => expect(screen.queryByText("Fresh cafe")).toBeNull());
  await save();
  await screen.unmount();
  cleanup.splice(0).forEach((stop) => stop());
  const recreated = context();
  await recreated.restore();
  expect(
    recreated.client.getQueryData(keys.NEW_BUSINESSES_QUERY_KEY),
  ).toMatchObject({ items: [] });
});
