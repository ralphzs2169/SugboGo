import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";

import Explore from "@/app/(explorer)/(tabs)/explore";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import { restoreSession } from "@/features/auth/services/restoreSession.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { suspendAuthSession } from "@/shared/api/authSessionGeneration.service";
import QueryPersistenceProvider from "@/shared/query/QueryPersistenceProvider";
import { queryClient } from "@/shared/query/queryClient";
import { queryPersistence } from "@/shared/query/queryPersistence.service";

import * as exploreApi from "../../api/exploreBusiness.service";
import useBusinessImpressions from "../../hooks/useBusinessImpressions";
import type { ExploreBusinessListResponse } from "../../types/exploreBusiness.types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
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
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

it("hydrates the regular Explore scroll view, then refreshes its feeds in place after validation", async () => {
  const fetchedAt = Date.now() - 6 * 24 * 60 * 60 * 1000;
  const localRead = jest.spyOn(queryPersistence, "readLocal").mockResolvedValue([
    {
      queryKey: ["explore-discovery"],
      data: page("Cached Hidden Gem"),
      fetchedAt,
      expiresAt: fetchedAt + 7 * 24 * 60 * 60 * 1000,
    },
    {
      queryKey: ["explore-new-businesses"],
      data: page("Cached New Place"),
      fetchedAt,
      expiresAt: fetchedAt + 7 * 24 * 60 * 60 * 1000,
    },
  ]);
  const validation = deferred<Awaited<ReturnType<typeof getCurrentUser>>>();
  jest.mocked(getCurrentUser).mockReturnValueOnce(validation.promise);
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

  const view = await render(
    <QueryPersistenceProvider>
      <Explore />
    </QueryPersistenceProvider>,
  );
  const scroll = view.getByTestId("explore-discovery-scroll");
  await waitFor(() => expect(view.getByText("Cached Hidden Gem")).toBeTruthy());
  expect(view.getByText("Cached New Place")).toBeTruthy();
  expect(view.getByText(/Offline.*Previously loaded/)).toBeTruthy();
  expect(localRead).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 7 }), expect.any(Function));
  expect(useBusinessImpressions).toHaveBeenCalledWith(0, 0, false);
  expect(view.queryByRole("button", { name: /Pocket/i })).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Search businesses or places" }));
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole("button", { name: /Cached Hidden Gem/ }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/recent-explore/[businessId]",
    params: { businessId: "17" },
  });

  let restoration!: ReturnType<typeof restoreSession>;
  await act(async () => {
    onlineManager.setOnline(true);
    restoration = restoreSession();
  });
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
  expect(exploreApi.getDiscoveryFeed).not.toHaveBeenCalled();
  expect(exploreApi.getNewBusinesses).not.toHaveBeenCalled();
  expect(exploreApi.getRecommendations).not.toHaveBeenCalled();
  expect(exploreApi.getExploreSpecialties).not.toHaveBeenCalled();
  expect(exploreApi.getDiscoveryShortcuts).not.toHaveBeenCalled();
  expect(exploreApi.getExploreFilterOptions).not.toHaveBeenCalled();
  expect(exploreApi.getOpenNowBusinesses).not.toHaveBeenCalled();
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();

  await act(async () => {
    validation.resolve({ id: 7 } as Awaited<ReturnType<typeof getCurrentUser>>);
    await restoration;
  });
  await waitFor(() => expect(exploreApi.getDiscoveryFeed).toHaveBeenCalledTimes(1));
  expect(view.getByText("Cached Hidden Gem")).toBeTruthy();
  expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
  expect(view.queryByText(/Offline.*Previously loaded/)).toBeNull();

  await act(async () => {
    live.resolve(success(page("Fresh Hidden Gem")));
  });
  await waitFor(() => expect(view.getByText("Fresh Hidden Gem")).toBeTruthy());
  expect(view.getByTestId("explore-discovery-scroll")).toBe(scroll);
  await view.unmount();
});
