import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import ExploreResultsScreen from "../SearchFilterResultScreen";
import useDiscoveryResults from "../../hooks/useDiscoveryResults";

const mockOnViewableItemsChanged = jest.fn();
const mockCardHighlight = jest.fn();
let mockRouteParams: Record<string, string> = { specialtyTagId: "12" };

jest.mock("../../stores/recentSearches.store", () => ({
  useRecentSearchesStore: () => ({
    queries: [],
    scope: "test",
    isHydrated: true,
    addQuery: jest.fn(),
    removeQuery: jest.fn(),
    clearQueries: jest.fn(),
  }),
}));

beforeEach(() => {
  mockRouteParams = { specialtyTagId: "12" };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock("@gorhom/bottom-sheet", () => ({}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("@/shared/components/AppText", () => {
  const { Text } = jest.requireActual("react-native");

  return Text;
});
jest.mock("@/shared/components/ErrorState", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockErrorState({
    onPrimaryAction,
  }: {
    onPrimaryAction: () => void;
  }) {
    return <Text onPress={onPrimaryAction}>Retry initial request</Text>;
  };
});
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 0,
}));
jest.mock("@/shared/hooks/useUserLocation", () => () => ({
  location: null,
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock(
  "../../components/search-filter-results/SearchFilterBottomSheet",
  () => () => null,
);
jest.mock("../../components/new-businesses/BusinessCard", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockBusinessCard({
    onPress,
    highlightQuery,
  }: {
    onPress: () => void;
    highlightQuery?: string;
  }) {
    mockCardHighlight(highlightQuery);
    return <Text onPress={onPress}>Open search result</Text>;
  };
});
jest.mock("../../hooks/useDiscoveryResults");
jest.mock("../../hooks/useExploreFilterOptions", () => () => ({
  options: {
    clusters: [],
    categories: [],
    specialty_tags: [],
  },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
}));
jest.mock("../../hooks/useResultsImpressions", () => () => ({
  onViewableItemsChanged: mockOnViewableItemsChanged,
  viewabilityConfig: {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
  },
}));

function resultState(isLoading: boolean) {
  return {
    businesses: [],
    totalItems: 0,
    highlightQuery: "",
    usedFuzzyFallback: false,
    isLoading,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isRefetching: false,
    fetchNextPage: jest.fn(async () => undefined),
    refetch: jest.fn(async () => undefined),
  };
}

it("shows the backend-confirmed cue and suppresses stale presentation during debounce", async () => {
  jest.useFakeTimers();
  mockRouteParams = { search: "advventre" };
  (useDiscoveryResults as jest.Mock).mockReturnValue({
    ...resultState(false),
    businesses: [{ id: 42 }],
    totalItems: 1,
    highlightQuery: "advventre",
    usedFuzzyFallback: true,
  });
  const screen = await render(<ExploreResultsScreen />);
  expect(screen.getByText("Showing similar matches")).toBeTruthy();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("advventre");

  await fireEvent.changeText(
    screen.getByLabelText("Search businesses or places"),
    "coffee",
  );
  expect(screen.queryByText("Showing similar matches")).toBeNull();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("");
  (useDiscoveryResults as jest.Mock).mockReturnValue({
    ...resultState(false),
    businesses: [{ id: 42 }],
    totalItems: 1,
    highlightQuery: "coffee",
    usedFuzzyFallback: false,
  });
  await act(async () => jest.advanceTimersByTime(350));
  expect(screen.queryByText("Showing similar matches")).toBeNull();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("coffee");
  await screen.unmount();
  jest.useRealTimers();
});

it.each(["initial", "empty", "normal"])(
  "omits the fuzzy cue in the %s state",
  async (state) => {
    mockRouteParams = state === "initial" ? {} : { search: "coffee" };
    (useDiscoveryResults as jest.Mock).mockReturnValue({
      ...resultState(false),
      businesses: state === "normal" ? [{ id: 42 }] : [],
      totalItems: state === "normal" ? 1 : 0,
      usedFuzzyFallback: state !== "normal",
    });
    const screen = await render(<ExploreResultsScreen />);
    expect(screen.queryByText("Showing similar matches")).toBeNull();
    if (state === "initial")
      expect(screen.getByText("Find your next Cebu favorite")).toBeTruthy();
    if (state === "empty")
      expect(screen.getByText("No places found")).toBeTruthy();
  },
);

it("keeps the result list viewability callback mounted while loading changes", async () => {
  (useDiscoveryResults as jest.Mock).mockReturnValue(resultState(true));
  const screen = await render(<ExploreResultsScreen />);

  expect(
    screen.getByTestId("search-filter-results-list").props
      .onViewableItemsChanged,
  ).toBe(mockOnViewableItemsChanged);

  (useDiscoveryResults as jest.Mock).mockReturnValue(resultState(false));
  await screen.rerender(<ExploreResultsScreen />);

  expect(
    screen.getByTestId("search-filter-results-list").props
      .onViewableItemsChanged,
  ).toBe(mockOnViewableItemsChanged);
});

it("attributes a filtered-result opening to SEARCH_RESULTS while preserving business parameters", async () => {
  (useDiscoveryResults as jest.Mock).mockReturnValue({
    ...resultState(false),
    businesses: [{ id: 42 }],
  });
  const screen = await render(<ExploreResultsScreen />);
  await fireEvent.press(screen.getByText("Open search result"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: {
      businessId: "42",
      distance: "",
      distanceAccuracy: "",
      profileSource: "SEARCH_RESULTS",
    },
  });
});

it("keeps loaded rows and the result header after a refresh fails", async () => {
  const state = {
    ...resultState(false),
    businesses: [{ id: 42 }],
    totalItems: 1,
  };
  (useDiscoveryResults as jest.Mock).mockReturnValue(state);
  const screen = await render(<ExploreResultsScreen />);
  (useDiscoveryResults as jest.Mock).mockReturnValue({
    ...state,
    error: new Error("Offline"),
  });
  await screen.rerender(<ExploreResultsScreen />);
  expect(screen.getByText("Open search result")).toBeTruthy();
  expect(screen.getByTestId("search-filter-results-list").props.data).toBe(
    state.businesses,
  );
  expect(
    screen.getByTestId("search-filter-results-list").props.ListHeaderComponent,
  ).not.toBeNull();
  expect(screen.queryByTestId("search-filter-results-error")).toBeNull();
});

it("keeps an initial error retry when no rows exist", async () => {
  const state = { ...resultState(false), error: new Error("Offline") };
  (useDiscoveryResults as jest.Mock).mockReturnValue(state);
  const screen = await render(<ExploreResultsScreen />);
  await fireEvent.press(screen.getByText("Retry initial request"));
  expect(state.refetch).toHaveBeenCalledTimes(1);
});

it("shows recovery while an initial offline query is paused", async () => {
  (useDiscoveryResults as jest.Mock).mockReturnValue({
    ...resultState(false),
    isPaused: true,
  });
  const screen = await render(<ExploreResultsScreen />);
  expect(screen.getByText("Retry initial request")).toBeTruthy();
  expect(screen.queryByTestId("search-filter-results-empty")).toBeNull();
});

it("keeps rows after a page failure and retries only through the continuation action", async () => {
  const state = {
    ...resultState(false),
    businesses: [{ id: 42 }],
    error: new Error("Page failed"),
    isFetchNextPageError: true,
    hasNextPage: true,
  };
  (useDiscoveryResults as jest.Mock).mockReturnValue(state);
  const screen = await render(<ExploreResultsScreen />);
  expect(screen.getByText("Open search result")).toBeTruthy();
  await fireEvent(
    screen.getByTestId("search-filter-results-list"),
    "endReached",
  );
  expect(state.fetchNextPage).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Retry loading more places"));
  expect(state.fetchNextPage).toHaveBeenCalledTimes(1);
  expect(state.refetch).not.toHaveBeenCalled();
});
