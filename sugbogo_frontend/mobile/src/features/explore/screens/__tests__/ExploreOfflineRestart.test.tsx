import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, {
  NetInfoStateType,
  type NetInfoState,
} from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import { router } from "expo-router";
import { AppState } from "react-native";

import Explore from "@/app/(explorer)/(tabs)/explore";
import OfflineSessionReconnect from "@/features/auth/components/OfflineSessionReconnect";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import * as offlineAccess from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import apiClient from "@/shared/api/apiClient.service";
import authClient from "@/shared/api/authClient.service";
import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "@/shared/api/storage.service";
import { subscribeNativeQueryLifecycle } from "@/shared/query/QueryLifecycle";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import { queryClient } from "@/shared/query/queryClient";
import { QUERY_PERSISTENCE_STORAGE_KEY } from "@/shared/query/queryPersistencePolicies";

import * as exploreApi from "../../api/exploreBusiness.service";
import * as exploreEmptyState from "../../components/ExploreSectionEmptyState";
import useBusinessImpressions from "../../hooks/useBusinessImpressions";
import type { ExploreBusinessListResponse } from "../../types/exploreBusiness.types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => "/explore",
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual("react").useEffect(effect, [effect]);
  },
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@react-native-community/netinfo", () =>
  jest.requireActual("@react-native-community/netinfo/jest/netinfo-mock"),
);
jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});
jest.mock("@/features/notifications/components/NotificationBellButton", () => () => null);
jest.mock("@/features/pockets/providers/PocketPickerContext", () => ({
  usePocketPicker: () => ({ isOpen: false, openPocketPicker: jest.fn() }),
}));
jest.mock("@/shared/hooks/useUserLocation", () => () => ({
  location: null,
  status: "unavailable",
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({ useTabBarSpacing: () => 0 }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../hooks/useBusinessImpressions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ retainBusinesses: jest.fn() })),
}));
jest.mock("../../api/exploreBusiness.service", () => ({
  getDiscoveryFeed: jest.fn(),
  getNewBusinesses: jest.fn(),
  getRecommendations: jest.fn(),
  getExploreSpecialties: jest.fn(),
  getDiscoveryShortcuts: jest.fn(),
  getExploreFilterOptions: jest.fn(),
  getOpenNowBusinesses: jest.fn(),
}));

function page(name: string): ExploreBusinessListResponse {
  return {
    items: [{
      ...businessFixture(17),
      business_name: name,
      display_cover_photo_url: null,
      is_pocketed: false,
    }],
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

function success<T>(data: T) {
  return { success: true as const, message: "OK", data };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

// Android emits this sample even though NetInfo types reachability as null for unknown.
const androidUnknown = {
  type: NetInfoStateType.unknown,
  isConnected: false,
  isInternetReachable: false,
  details: null,
} as unknown as NetInfoState;
const disconnected: NetInfoState = {
  type: NetInfoStateType.none,
  isConnected: false,
  isInternetReachable: false,
  details: null,
};
const connected: NetInfoState = {
  type: NetInfoStateType.ethernet,
  isConnected: true,
  isInternetReachable: true,
  details: {
    isConnectionExpensive: false,
    ipAddress: null,
    subnet: null,
  },
};
const connectedWifi: NetInfoState = {
  ...connected,
  type: NetInfoStateType.wifi,
  details: {
    ...connected.details,
    ssid: null,
    bssid: null,
    strength: null,
    frequency: null,
    linkSpeed: null,
    rxLinkSpeed: null,
    txLinkSpeed: null,
  },
};
const userResponse = success({ id: 7, has_completed_interest_selection: true });
const verification = new MockAdapter(apiClient);
const refresh = new MockAdapter(authClient);
let network: NetInfoState;
let onNetworkChanged: Parameters<typeof NetInfo.addEventListener>[0];
let stopLifecycle: (() => void) | undefined;

function setNetwork(state: NetInfoState) {
  network = state;
  onNetworkChanged(state);
}

/** Uses the root's restoring gate with the actual Explore route and reconnect handler. */
function StartupExplore() {
  const restoration = useRestoreSession();
  const loading = useAuthStore((state) => state.isLoading);
  if (loading) return null;

  return (
    <QueryPersistenceProvider>
      <OfflineSessionReconnect onRecoveryRequired={restoration.requireRecovery} />
      <Explore />
    </QueryPersistenceProvider>
  );
}

function renderStartup(initial: NetInfoState = disconnected) {
  network = initial;
  stopLifecycle = subscribeNativeQueryLifecycle();
  return render(<StartupExplore />);
}

beforeEach(async () => {
  jest.clearAllMocks();
  verification.reset();
  refresh.reset();
  queryClient.clear();
  onlineManager.setOnline(true);
  jest.spyOn(AppState, "addEventListener").mockImplementation((event, listener) => {
    if (event === "change") listener("active");
    return { remove: jest.fn() };
  });
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  useOfflineAccessStore.setState({
    ownerId: null,
    isRevoking: false,
    recentExplore: null,
    sessionSuspended: false,
    retrySessionAfter: null,
  });
  jest.mocked(NetInfo.fetch).mockImplementation(async () => network);
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    onNetworkChanged = listener;
    listener(network);
    return jest.fn();
  });
  await saveAccessToken("saved-token");
  await saveRefreshToken("saved-refresh");
  jest.spyOn(offlineAccess, "getOfflineOwner").mockResolvedValue(null);
  jest.spyOn(offlineAccess, "getRestorableOfflineOwner").mockResolvedValue(null);
  jest.spyOn(offlineAccess, "rememberOfflineResources").mockResolvedValue(undefined);
  jest.mocked(exploreApi.getDiscoveryFeed).mockResolvedValue(
    success(page("Live Hidden Gem")),
  );
  jest.mocked(exploreApi.getNewBusinesses).mockResolvedValue(success(page("Live New Place")));
  jest.mocked(exploreApi.getRecommendations).mockResolvedValue(
    success({ ...page(""), items: [], is_personalized: false }),
  );
  jest.mocked(exploreApi.getDiscoveryShortcuts).mockResolvedValue(success([]));
  jest.mocked(exploreApi.getExploreSpecialties).mockResolvedValue(success([]));
  jest.mocked(exploreApi.getExploreFilterOptions).mockResolvedValue(
    success({ clusters: [], categories: [], specialty_tags: [] }),
  );
});

afterEach(async () => {
  stopLifecycle?.();
  stopLifecycle = undefined;
  await queryClient.cancelQueries();
  queryClient.clear();
  await AsyncStorage.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("shows an offline empty state on Explore when the saved session has no cache grant", async () => {
  queryClient.setQueryData(["explore-discovery"], page("Unscoped cached place"));
  const view = await renderStartup();

  expect(await view.findByText("No saved Explore content")).toBeTruthy();
  expect(view.getByText("Offline")).toBeTruthy();
  expect(view.queryByText("Unscoped cached place")).toBeNull();
  expect(view.queryByRole("button", { name: "Sign in" })).toBeNull();
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();
  expect(verification.history.get).toHaveLength(0);
  await view.unmount();
});

it.each([
  ["confirmed online", connected],
  ["Android unknown", androidUnknown],
] as const)(
  "restores a valid access token on %s startup without rendering offline",
  async (_, initial) => {
    verification.onGet("/users/me/").reply(200, userResponse);
    const emptyState = jest.spyOn(exploreEmptyState, "default");

    const view = await renderStartup(initial);

    expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
    expect(verification.history.get).toHaveLength(1);
    expect(refresh.history.post).toHaveLength(0);
    expect(emptyState.mock.calls.map(([props]) => props.title)).not.toContain(
      "No saved Explore content",
    );
    expect(view.queryByText("Offline")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    await view.unmount();
  },
);

it("refreshes and replays an expired saved token while Android is still unknown", async () => {
  const sentTokens: unknown[] = [];
  verification.onGet("/users/me/").replyOnce((request) => {
    sentTokens.push(request.headers?.Authorization);
    return [401];
  });
  verification.onGet("/users/me/").replyOnce((request) => {
    sentTokens.push(request.headers?.Authorization);
    return [200, userResponse];
  });
  refresh.onPost("/auth/refresh/", { refresh: "saved-refresh" }).reply(200, {
    access: "renewed-access",
    refresh: "renewed-refresh",
  });
  const emptyState = jest.spyOn(exploreEmptyState, "default");

  const view = await renderStartup(androidUnknown);

  expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
  expect(sentTokens).toEqual(["Bearer saved-token", "Bearer renewed-access"]);
  expect(refresh.history.post).toHaveLength(1);
  expect(await getAccessToken()).toBe("renewed-access");
  expect(await getRefreshToken()).toBe("renewed-refresh");
  expect(emptyState.mock.calls.map(([props]) => props.title)).not.toContain(
    "No saved Explore content",
  );
  expect(router.replace).not.toHaveBeenCalled();
  await view.unmount();
});

it("shows recovery on the first Explore frame after an API failure while Android is unknown", async () => {
  jest.useFakeTimers();
  verification.onGet("/users/me/").replyOnce(503);
  verification.onGet("/users/me/").replyOnce(503);
  verification.onGet("/users/me/").reply(200, userResponse);
  const emptyState = jest.spyOn(exploreEmptyState, "default");

  const view = await renderStartup(androidUnknown);

  expect(await view.findByText("Unable to connect to SugboGo")).toBeTruthy();
  expect(view.queryByText("Offline")).toBeNull();
  await waitFor(() => expect(verification.history.get).toHaveLength(2));
  await act(async () => setNetwork(connected));
  await act(async () => jest.advanceTimersByTimeAsync(5_000));
  expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
  expect(emptyState.mock.calls.map(([props]) => props.title)).not.toContain(
    "No saved Explore content",
  );
  expect(verification.history.get).toHaveLength(3);
  expect(router.replace).not.toHaveBeenCalled();
  await view.unmount();
});

it("removes the offline empty state on unknown before confirmed online resumes the session", async () => {
  verification.onGet("/users/me/").reply(200, userResponse);
  const view = await renderStartup();

  expect(await view.findByText("No saved Explore content")).toBeTruthy();
  await act(async () => setNetwork(androidUnknown));
  expect(onlineManager.isOnline()).toBe(false);
  expect(view.getByText("Unable to connect to SugboGo")).toBeTruthy();
  expect(view.queryByText("No saved Explore content")).toBeNull();
  expect(view.queryByText("Offline")).toBeNull();
  expect(verification.history.get).toHaveLength(0);

  await act(async () => setNetwork(connected));
  expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
  expect(verification.history.get).toHaveLength(1);
  expect(router.replace).not.toHaveBeenCalled();
  await view.unmount();
});

it.each([
  { cache: "no eligible cache", hasCache: false },
  { cache: "eligible cached Explore", hasCache: true },
])(
  "restarts exhausted startup verification on confirmed Wi-Fi with $cache",
  async ({ hasCache }) => {
    jest.useFakeTimers();
    if (hasCache) {
      jest.mocked(offlineAccess.getOfflineOwner).mockResolvedValue(7);
      await AsyncStorage.setItem(
        QUERY_PERSISTENCE_STORAGE_KEY,
        JSON.stringify({
          formatVersion: 1,
          policyVersion: 1,
          ownerId: 7,
          apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
          entries: [
            {
              queryKey: ["explore-discovery"],
              policyId: "explore-discovery",
              policyVersion: 2,
              fetchedAt: Date.now(),
              data: page("Cached Hidden Gem"),
            },
          ],
        }),
      );
    }
    const endpoint = "/users/me/";
    verification.onGet(endpoint).reply(503);
    const view = await renderStartup(androidUnknown);
    await waitFor(() => expect(verification.history.get).toHaveLength(2));

    // The initial verification and mount-time reconnect precede the three retries.
    for (const delay of [5_000, 15_000, 30_000]) {
      await act(async () => jest.advanceTimersByTimeAsync(delay));
    }
    expect(verification.history.get).toHaveLength(5);
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(verification.history.get).toHaveLength(5);
    expect(onlineManager.isOnline()).toBe(true);
    expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();

    const recovery = deferred<[number, typeof userResponse]>();
    verification.onGet(endpoint).reply(() => recovery.promise);
    const scroll = view.getByTestId("explore-discovery-scroll");
    await act(async () => {
      setNetwork(connectedWifi);
      setNetwork(connectedWifi);
    });
    expect(onlineManager.isOnline()).toBe(true);
    expect(verification.history.get).toHaveLength(6);
    if (hasCache) {
      expect(view.getByText("Cached Hidden Gem")).toBeTruthy();
      expect(view.getByText("Previously loaded content")).toBeTruthy();
    } else {
      expect(view.getByRole("button", { name: /tap to retry/i })).toBeTruthy();
    }
    expect(view.queryByText("Offline")).toBeNull();

    await act(async () => recovery.resolve([200, userResponse]));
    expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(verification.history.get).toHaveLength(6);
    expect(router.replace).not.toHaveBeenCalled();
    if (hasCache) {
      expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
    }
    await view.unmount();
  },
);

it("lets manual Retry verify an unknown state even when queries are still paused", async () => {
  verification.onGet("/users/me/").reply(200, userResponse);
  const view = await renderStartup();
  expect(await view.findByText("No saved Explore content")).toBeTruthy();

  await act(async () => setNetwork(androidUnknown));
  await fireEvent.press(view.getByRole("button", { name: /tap to retry/i }));
  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  expect(verification.history.get).toHaveLength(1);
  expect(onlineManager.isOnline()).toBe(false);
  expect(view.queryByText("No saved Explore content")).toBeNull();
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();

  await act(async () => setNetwork(connected));
  expect(await view.findByText("Live Hidden Gem")).toBeTruthy();
  expect(verification.history.get).toHaveLength(1);
  await view.unmount();
});

it("shows a retryable connection error on online startup with no cached feeds", async () => {
  jest.useFakeTimers();
  verification.onGet("/users/me/").replyOnce(503);
  verification.onGet("/users/me/").replyOnce(503);
  verification.onGet("/users/me/").reply(200, userResponse);
  const emptyState = jest.spyOn(exploreEmptyState, "default");
  const view = await renderStartup(connected);

  expect(await view.findByText("Unable to connect to SugboGo")).toBeTruthy();
  expect(view.queryByText("No saved Explore content")).toBeNull();
  expect(view.queryByText("Offline")).toBeNull();
  const retry = view.getByRole("button", { name: /tap to retry/i });
  await waitFor(() => expect(verification.history.get).toHaveLength(2));

  await fireEvent.press(retry);
  await waitFor(() => expect(view.getByText("Live Hidden Gem")).toBeTruthy());
  expect(verification.history.get).toHaveLength(3);
  expect(emptyState.mock.calls.map(([props]) => props.title)).not.toContain(
    "No saved Explore content",
  );
  expect(router.replace).not.toHaveBeenCalled();
  await view.unmount();
});

it("keeps fresh cached Explore after a 503 and refreshes all three feeds in place after retry", async () => {
  jest.useFakeTimers();
  jest.mocked(offlineAccess.getOfflineOwner).mockResolvedValue(7);
  const fetchedAt = Date.now() - 60_000;
  const recommendationPage = page("Cached Recommendation");
  const cachedFeeds = [
    ["explore-discovery", 2, page("Cached Hidden Gem")],
    ["explore-new-businesses", 1, page("Cached New Place")],
    ["explore-recommendations", 1, {
      ...recommendationPage,
      items: recommendationPage.items.map((item) => ({
        ...item,
        recommendation_reason: null,
      })),
    }],
  ] as const;
  await AsyncStorage.setItem(
    QUERY_PERSISTENCE_STORAGE_KEY,
    JSON.stringify({
      formatVersion: 1,
      policyVersion: 1,
      ownerId: 7,
      apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      entries: cachedFeeds.map(([key, policyVersion, data]) => ({
        queryKey: [key],
        policyId: key,
        policyVersion,
        fetchedAt,
        data,
      })),
    }),
  );
  const validation = deferred<[number, typeof userResponse]>();
  verification.onGet("/users/me/").replyOnce(503);
  verification.onGet("/users/me/").reply(() => validation.promise);
  const live = deferred<Awaited<ReturnType<typeof exploreApi.getDiscoveryFeed>>>();
  jest.mocked(exploreApi.getDiscoveryFeed).mockReturnValueOnce(live.promise);
  jest.mocked(exploreApi.getNewBusinesses).mockResolvedValue(
    success(page("Cached New Place")),
  );

  const view = await renderStartup();
  await waitFor(() => expect(view.getByText("Cached Hidden Gem")).toBeTruthy());
  const scroll = view.getByTestId("explore-discovery-scroll");
  expect(view.getByText("Cached New Place")).toBeTruthy();
  expect(view.getByText(/Offline.*Previously loaded/)).toBeTruthy();
  expect(useBusinessImpressions).toHaveBeenCalledWith(0, 0, false);
  expect(view.queryByRole("button", { name: /Pocket/i })).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Search businesses or places" }));
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole("button", { name: /Cached Hidden Gem/ }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/recent-explore/[businessId]",
    params: { businessId: "17" },
  });

  expect(verification.history.get).toHaveLength(0);
  await act(async () => setNetwork(connected));
  await waitFor(() => expect(verification.history.get).toHaveLength(1));
  expect(await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY)).toContain("Cached Hidden Gem");
  expect(view.getByText("Previously loaded content")).toBeTruthy();

  await act(async () => jest.advanceTimersByTimeAsync(5_000));
  expect(verification.history.get).toHaveLength(2);
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();
  expect(exploreApi.getNewBusinesses).not.toHaveBeenCalled();
  expect(exploreApi.getRecommendations).not.toHaveBeenCalled();
  expect(exploreApi.getExploreSpecialties).not.toHaveBeenCalled();
  expect(exploreApi.getDiscoveryShortcuts).not.toHaveBeenCalled();
  expect(exploreApi.getExploreFilterOptions).not.toHaveBeenCalled();
  expect(exploreApi.getOpenNowBusinesses).not.toHaveBeenCalled();
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();

  await act(async () => {
    validation.resolve([200, userResponse]);
  });
  await waitFor(() => expect(exploreApi.getDiscoveryFeed).toHaveBeenCalledTimes(1));
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();
  expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
  expect(view.queryByText("Previously loaded content")).toBeNull();

  await act(async () => {
    live.resolve(success(page("Fresh Hidden Gem")));
  });
  await waitFor(() => expect(view.getByText("Fresh Hidden Gem")).toBeTruthy());
  expect(exploreApi.getDiscoveryFeed).toHaveBeenCalledTimes(1);
  expect(exploreApi.getNewBusinesses).toHaveBeenCalledTimes(1);
  expect(exploreApi.getRecommendations).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
  await view.unmount();
});
