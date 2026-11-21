import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { router } from "expo-router";

import Explore from "@/app/(explorer)/(tabs)/explore";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import OfflineSessionReconnect from "@/features/auth/components/OfflineSessionReconnect";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import * as offlineAccess from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { suspendAuthSession } from "@/shared/api/authSessionGeneration.service";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import { queryClient } from "@/shared/query/queryClient";
import { QUERY_PERSISTENCE_STORAGE_KEY } from "@/shared/query/queryPersistencePolicies";

import * as exploreApi from "../../api/exploreBusiness.service";
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
jest.mock("@/features/auth/api/auth.service", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/shared/api/storage.service", () => ({
  getAccessToken: jest.fn().mockResolvedValue("saved-token"),
}));
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

beforeEach(() => {
  queryClient.clear();
  onlineManager.setOnline(false);
  focusManager.setFocused(true);
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  useOfflineAccessStore.setState({
    ownerId: null,
    isRevoking: false,
    recentExplore: {
      ownerId: 7,
      apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      generation: suspendAuthSession(),
    },
  });
});

afterEach(async () => {
  await queryClient.cancelQueries();
  queryClient.clear();
  await AsyncStorage.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("shows an offline empty state on Explore when the saved session has no cache grant", async () => {
  useOfflineAccessStore.setState({ recentExplore: null });
  queryClient.setQueryData(["explore-discovery"], page("Unscoped cached place"));
  const view = await render(
    <QueryPersistenceProvider>
      <Explore />
    </QueryPersistenceProvider>,
  );

  expect(view.getByText("Offline")).toBeTruthy();
  expect(view.getByText("No saved Explore content")).toBeTruthy();
  expect(view.queryByText("Unscoped cached place")).toBeNull();
  expect(view.queryByRole("button", { name: "Sign in" })).toBeNull();
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();
  await view.unmount();
});

it("keeps fresh cached Explore after a 503 and refreshes all three feeds in place after retry", async () => {
  jest.useFakeTimers();
  jest.spyOn(offlineAccess, "getOfflineOwner").mockResolvedValue(7);
  jest.spyOn(offlineAccess, "getRestorableOfflineOwner").mockResolvedValue(null);
  jest.spyOn(offlineAccess, "rememberOfflineResources").mockResolvedValue(undefined);
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
  const validation = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest.mocked(getCurrentUser)
    .mockRejectedValueOnce(Object.assign(new AxiosError("Unavailable"), {
      response: { status: 503 },
    }))
    .mockReturnValueOnce(validation.promise);
  const live = deferred<Awaited<ReturnType<typeof exploreApi.getDiscoveryFeed>>>();
  jest.mocked(exploreApi.getDiscoveryFeed).mockReturnValueOnce(live.promise);
  jest.mocked(exploreApi.getNewBusinesses).mockResolvedValue(
    success(page("Cached New Place")),
  );
  jest.mocked(exploreApi.getRecommendations).mockResolvedValue(
    success({ ...page(""), items: [], is_personalized: false }),
  );
  jest.mocked(exploreApi.getDiscoveryShortcuts).mockResolvedValue(success([]));
  jest.mocked(exploreApi.getExploreSpecialties).mockResolvedValue(success([]));
  jest.mocked(exploreApi.getExploreFilterOptions).mockResolvedValue(
    success({ clusters: [], categories: [], specialty_tags: [] }),
  );

  const onRecoveryRequired = jest.fn();
  const view = await render(
    <QueryPersistenceProvider>
      <OfflineSessionReconnect onRecoveryRequired={onRecoveryRequired} />
      <Explore />
    </QueryPersistenceProvider>,
  );
  const scroll = view.getByTestId("explore-discovery-scroll");
  await waitFor(() => expect(view.getByText("Cached Hidden Gem")).toBeTruthy());
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

  await act(async () => onlineManager.setOnline(true));
  await waitFor(() => expect(offlineAccess.getOfflineOwner).toHaveBeenCalled());
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(onRecoveryRequired).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(QUERY_PERSISTENCE_STORAGE_KEY)).toContain("Cached Hidden Gem");
  expect(view.getByText(/Offline.*Previously loaded/)).toBeTruthy();

  await act(async () => jest.advanceTimersByTimeAsync(5_000));
  expect(getCurrentUser).toHaveBeenCalledTimes(2);
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();
  expect(exploreApi.getNewBusinesses).not.toHaveBeenCalled();
  expect(exploreApi.getRecommendations).not.toHaveBeenCalled();
  expect(exploreApi.getExploreSpecialties).not.toHaveBeenCalled();
  expect(exploreApi.getDiscoveryShortcuts).not.toHaveBeenCalled();
  expect(exploreApi.getExploreFilterOptions).not.toHaveBeenCalled();
  expect(exploreApi.getOpenNowBusinesses).not.toHaveBeenCalled();
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();

  await act(async () => {
    validation.resolve({
      id: 7,
      has_completed_interest_selection: true,
    } as Awaited<ReturnType<typeof getCurrentUser>>);
  });
  await waitFor(() => expect(exploreApi.getDiscoveryFeed).toHaveBeenCalledTimes(1));
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();
  expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
  expect(view.queryByText(/Offline.*Previously loaded/)).toBeNull();

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
