import React from "react";
import { render } from "@testing-library/react-native";

import ExploreResultsScreen from "../SearchFilterResultScreen";
import useDiscoveryResults from "../../hooks/useDiscoveryResults";

const mockOnViewableItemsChanged = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ specialtyTagId: "12" }),
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
jest.mock("@/shared/components/ErrorState", () => () => null);
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 0,
}));
jest.mock("@/shared/hooks/useUserLocation", () => () => ({
  location: null,
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../../components/results/ExploreFiltersSheet", () => () => null);
jest.mock("../../components/new-businesses/BusinessCard", () => () => null);
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
    isLoading,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isRefetching: false,
    fetchNextPage: jest.fn(async () => undefined),
    refetch: jest.fn(async () => undefined),
  };
}

it("keeps the result list viewability callback mounted while loading changes", async () => {
  (useDiscoveryResults as jest.Mock).mockReturnValue(resultState(true));
  const screen = await render(<ExploreResultsScreen />);

  expect(
    screen.getByTestId("explore-results-list").props.onViewableItemsChanged,
  ).toBe(mockOnViewableItemsChanged);

  (useDiscoveryResults as jest.Mock).mockReturnValue(resultState(false));
  await screen.rerender(<ExploreResultsScreen />);

  expect(
    screen.getByTestId("explore-results-list").props.onViewableItemsChanged,
  ).toBe(mockOnViewableItemsChanged);
});
