import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";

import { restoreSession } from "@/features/auth/services/restoreSession.service";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { OFFLINE_API_SCOPE } from "@/features/offline-routes/constants/offlineRoutes.constants";
import {
  clearOfflineAccess,
  releaseOfflineAccessIfEmpty,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
  suspendAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import { queryClient } from "@/shared/query/queryClient";
import { queryPersistence } from "@/shared/query/queryPersistence.service";
import { QUERY_PERSISTENCE_STORAGE_KEY } from "@/shared/query/queryPersistencePolicies";
import { createApiError } from "@/shared/utils/apiErrors";
import {
  isRecentExploreCurrent,
  readRecentExploreFeeds,
  restoreRecentExploreAccess,
} from "../recentExplore.service";
import { recentBusinessDetails } from "../recentBusinessDetails.service";
import { hasSavedJourneysForOfflineAccess } from "@/features/offline-routes/services/savedJourneys.service";
import { hasBusinessSnapshotsForOfflineAccess } from "@/features/offline-pockets/services/offlinePockets.service";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getAccessToken: jest.fn(),
  clearSessionTokens: jest.fn(),
}));
jest.mock("@/features/auth/api/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/savedJourneys.service", () => ({
  hasSavedJourneysForOfflineAccess: jest.fn(),
}));
jest.mock("@/features/offline-pockets/services/offlinePockets.service", () => ({
  hasBusinessSnapshotsForOfflineAccess: jest.fn(),
}));

let clock: number;
let stop: (() => void) | null;
function marker(ownerId = 7, apiScope = OFFLINE_API_SCOPE) {
  return JSON.stringify({ version: 1, ownerId, apiScope });
}
function page(count = 1) {
  return {
    items: count ? [businessFixture()] : [],
    pagination: {
      page: 1,
      page_size: 10,
      total_items: count,
      total_pages: count,
      has_next: false,
      has_previous: false,
    },
  };
}

beforeEach(async () => {
  clock = Date.parse("2026-10-22T01:00:00Z");
  jest.spyOn(Date, "now").mockImplementation(() => clock);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  beginAuthSession();
  await queryPersistence.flush();
  await recentBusinessDetails.flush();
  await AsyncStorage.clear();
  queryClient.clear();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    ownerId: null,
    recentExplore: null,
    isRevoking: false,
  });
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(marker());
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(getAccessToken).mockResolvedValue("stored-token");
  jest.mocked(clearSessionTokens).mockResolvedValue(true);
  jest
    .mocked(getCurrentUser)
    .mockRejectedValue(createApiError("NETWORK_ERROR"));
  jest.mocked(hasSavedJourneysForOfflineAccess).mockResolvedValue(false);
  jest.mocked(hasBusinessSnapshotsForOfflineAccess).mockResolvedValue(false);
  stop = null;
});
afterEach(async () => {
  stop?.();
  invalidateAuthSession();
  await queryPersistence.flush();
  await recentBusinessDetails.flush();
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.restoreAllMocks();
});

async function seed(key = "explore-discovery", data: unknown = page()) {
  const session = queryPersistence.openSession(queryClient);
  stop = session.track();
  await queryClient.fetchQuery({ queryKey: [key], queryFn: async () => data });
  await persistQueryClientSave({ queryClient, ...session.persistOptions });
  stop();
  stop = null;
  // Model cold restart: only storage and secure identity marker survive.
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  queryClient.clear();
}

it.each([
  [true, "For You"],
  [false, "Explore local picks"],
  [undefined, "Explore local picks"],
] as const)(
  "labels recent recommendations from authoritative state %s",
  async (isPersonalized, title) => {
    const data = page();
    if (isPersonalized !== undefined) {
      Object.assign(data, { is_personalized: isPersonalized });
    }
    Object.assign(data.items[0], { recommendation_reason: null });
    await seed("explore-recommendations", data);
    await restoreSession();
    const grant = useOfflineAccessStore.getState().recentExplore;

    expect(grant).not.toBeNull();
    const feeds = await readRecentExploreFeeds(grant!);
    expect(feeds[0].title).toBe(title);
    expect(feeds[0].items[0].id).toBe(data.items[0].id);
  },
);

it.each([
  "explore-discovery",
  "explore-new-businesses",
  "explore-recommendations",
])("grants read-only transport access for validated %s", async (key) => {
  const data = page();
  if (key === "explore-recommendations")
    Object.assign(data.items[0], { recommendation_reason: null });
  await seed(key, data);
  const original = await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY);
  await restoreSession();
  const grant = useOfflineAccessStore.getState().recentExplore;
  expect(grant?.ownerId).toBe(7);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useAuthStore.getState().user).toBeNull();
  expect(useOfflineAccessStore.getState().ownerId).toBeNull();
  expect(queryClient.getQueryData([key])).toBeUndefined();
  expect((await readRecentExploreFeeds(grant!))[0].items[0].business_name).toBe(
    "Sugbo Cafe",
  );
  expect(await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(
    original,
  );
});

it.each([
  "missing",
  "expired",
  "corrupt",
  "version",
  "owner",
  "API",
  "empty",
  "metadata-only",
])("rejects %s local Explore content", async (kind) => {
  await seed("explore-discovery", page(kind === "empty" ? 0 : 1));
  const json = JSON.parse(
    (await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY))!,
  );
  if (kind === "missing")
    await AsyncStorage.removeItem(QUERY_PERSISTENCE_STORAGE_KEY);
  else if (kind === "expired") clock += 24 * 60 * 60 * 1000;
  else {
    if (kind === "version") json.policyVersion += 1;
    if (kind === "owner") json.ownerId = 8;
    if (kind === "API") json.apiScope = "wrong-api";
    if (kind === "metadata-only") json.entries = [];
    await AsyncStorage.setItem(
      QUERY_PERSISTENCE_STORAGE_KEY,
      kind === "corrupt" ? "broken" : JSON.stringify(json),
    );
  }
  await restoreSession();
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
});

it.each(["AUTH_ERROR", "ACCOUNT_DISABLED", "PERMISSION_DENIED"])(
  "denies definitive %s and clears temporary data",
  async (code) => {
    await seed();
    jest.mocked(getCurrentUser).mockRejectedValueOnce(createApiError(code));
    await restoreSession();
    await queryPersistence.flush();
    expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
    expect(
      await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY),
    ).toBeNull();
  },
);

it.each(["journeys", "pockets", "both"])(
  "preserves %s access alongside Recent Explore",
  async (kind) => {
    await seed();
    jest
      .mocked(hasSavedJourneysForOfflineAccess)
      .mockResolvedValue(kind !== "pockets");
    jest
      .mocked(hasBusinessSnapshotsForOfflineAccess)
      .mockResolvedValue(kind !== "journeys");
    await restoreSession();
    expect(useOfflineAccessStore.getState().ownerId).toBe(7);
    expect(useOfflineAccessStore.getState().recentExplore?.ownerId).toBe(7);
  },
);

it("retains the recent identity marker when durable resources are cleared", async () => {
  await seed();
  await restoreSession();
  await releaseOfflineAccessIfEmpty(7, getAuthSessionGeneration());
  expect(useOfflineAccessStore.getState().recentExplore?.ownerId).toBe(7);
  expect(jest.mocked(SecureStore.deleteItemAsync)).not.toHaveBeenCalled();
});

it("revalidates without authenticating on network availability alone, then restores matching Query data", async () => {
  await seed();
  await restoreSession();
  const grant = useOfflineAccessStore.getState().recentExplore;
  expect(grant).not.toBeNull();
  jest.mocked(getCurrentUser).mockResolvedValueOnce({ id: 7 } as never);
  // The anonymous root provider's handle must not erase disk on successful validation.
  queryPersistence.openSession(queryClient);
  await restoreSession();
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
  const session = queryPersistence.openSession(queryClient);
  const restored = await session.persistOptions.persister.restoreClient();
  expect(restored?.clientState.queries[0].state.data).toMatchObject({
    items: [{ id: 21 }],
  });
});

it("revokes an existing grant when reconnect validation definitively rejects credentials", async () => {
  await seed();
  await restoreSession();
  const old = useOfflineAccessStore.getState().recentExplore!;
  jest
    .mocked(getCurrentUser)
    .mockRejectedValueOnce(createApiError("AUTH_ERROR"));
  await restoreSession();
  await queryPersistence.flush();
  expect(isRecentExploreCurrent(old)).toBe(false);
  expect(await readRecentExploreFeeds(old)).toEqual([]);
  expect(await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY)).toBeNull();
});

it("ignores eligibility and reads that finish after explicit revocation or same-user replacement", async () => {
  await seed();
  const generation = suspendAuthSession();
  let resolve!: (value: string | null) => void;
  const pending = new Promise<string | null>((done) => {
    resolve = done;
  });
  jest.mocked(SecureStore.getItemAsync).mockReturnValueOnce(pending);
  const checking = restoreRecentExploreAccess(generation);
  beginAuthSession();
  resolve(marker());
  expect(await checking).toBeNull();
});

it("explicit logout and account replacement immediately revoke local presentation", async () => {
  await seed();
  await restoreSession();
  const old = useOfflineAccessStore.getState().recentExplore!;
  await clearOfflineAccess();
  expect(isRecentExploreCurrent(old)).toBe(false);
  expect(await readRecentExploreFeeds(old)).toEqual([]);
  beginAuthSession();
  useAuthStore.getState().setUser({ id: 8 } as never);
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
});

it("does not authorize from a retained marker after definitive invalidation", async () => {
  await seed();
  const generation = invalidateAuthSession();
  expect(await restoreRecentExploreAccess(generation)).toBeNull();
});

it("never publishes a delayed local payload into a replacement session", async () => {
  await seed();
  await restoreSession();
  const grant = useOfflineAccessStore.getState().recentExplore!;
  const json = await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY);
  let resolve!: (value: string | null) => void;
  let started!: () => void;
  const reading = new Promise<string | null>((done) => {
    resolve = done;
  });
  const began = new Promise<void>((done) => {
    started = done;
  });
  jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(async () => {
    started();
    return reading;
  });
  const oldRead = readRecentExploreFeeds(grant);
  await began;
  beginAuthSession();
  useAuthStore.getState().setUser({ id: 8 } as never);
  resolve(json);
  expect(await oldRead).toEqual([]);
});

it("does not hydrate the previous owner when reconnect validates a different identity", async () => {
  await seed();
  await restoreSession();
  jest.mocked(getCurrentUser).mockResolvedValueOnce({ id: 8 } as never);
  await restoreSession();
  const session = queryPersistence.openSession(queryClient);
  expect(
    await session.persistOptions.persister.restoreClient(),
  ).toBeUndefined();
  expect(useAuthStore.getState().user?.id).toBe(8);
  expect(useOfflineAccessStore.getState().recentExplore).toBeNull();
});

it("reads Task 4 detail only through the current local grant without authenticating or renewing age", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), clock);
  await seed();
  await restoreSession();
  const grant = useOfflineAccessStore.getState().recentExplore!;
  const local = { ...grant, current: () => isRecentExploreCurrent(grant) };
  const detail = await recentBusinessDetails.readLocal(21, local);
  expect(detail?.business.business_name).toBe("Sugbo Cafe");
  expect(detail?.fetchedAt).toBe(new Date(clock).toISOString());
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  invalidateAuthSession();
  expect(await recentBusinessDetails.readLocal(21, local)).toBeNull();
});
