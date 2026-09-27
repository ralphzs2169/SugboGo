import { fireEvent, render, waitFor } from "@testing-library/react-native";

import ExploreCollectionScreen from "../ExploreCollectionScreen";
import useExploreCollection from "../../hooks/useExploreCollection";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";

const mockPush = jest.fn();
const mockRefetch = jest.fn(async () => undefined);
const mockFetchNextPage = jest.fn(async () => undefined);
const mockOnViewableItemsChanged = jest.fn();
let mockCollectionType = "hidden-gems";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => ({ collectionType: mockCollectionType }),
  useNavigation: () => ({
    isFocused: () => true,
  }),
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
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({
    primaryActionTitle,
    onPrimaryAction,
  }: {
    primaryActionTitle: string;
    onPrimaryAction: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual("react-native");

    return (
      <Pressable testID="error-action" onPress={onPrimaryAction}>
        <Text>{primaryActionTitle}</Text>
      </Pressable>
    );
  },
}));
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
  () => ({
    __esModule: true,
    default: ({
      draft,
      onChange,
      onApply,
    }: {
      draft: {
        search: string;
        clusterId: number | null;
        categoryIds: number[];
        specialtyTagId: number | null;
      };
      onChange: (criteria: typeof draft) => void;
      onApply: () => void;
    }) => {
      const { Button, Text, View } = jest.requireActual("react-native");

      return (
        <View>
          <Text>{`Draft categories: ${draft.categoryIds.join(",")}`}</Text>
          <Button
            title="Draft taxonomy filters"
            onPress={() =>
              onChange({
                ...draft,
                clusterId: 1,
                categoryIds: [7, 4],
                specialtyTagId: 12,
              })
            }
          />
          <Button title="Apply taxonomy filters" onPress={onApply} />
        </View>
      );
    },
  }),
);
jest.mock("../../components/new-businesses/BusinessCard", () => ({
  __esModule: true,
  default: ({
    business,
    onPress,
  }: {
    business: ExploreBusiness;
    onPress: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual("react-native");

    return (
      <Pressable testID={`collection-card-${business.id}`} onPress={onPress}>
        <Text>{business.business_name}</Text>
      </Pressable>
    );
  },
}));
jest.mock("../../hooks/useExploreCollection");
jest.mock("../../hooks/useExploreFilterOptions", () => () => ({
  options: {
    clusters: [{ id: 1, name: "Food", icon: "food" }],
    categories: [
      { id: 4, name: "Cafe", cluster_id: 1 },
      { id: 7, name: "Restaurant", cluster_id: 1 },
    ],
    specialty_tags: [
      { id: 12, name: "Coffee", color: "brown", icon: "coffee" },
    ],
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

const business: ExploreBusiness = {
  id: 42,
  business_name: "Collection Place",
  cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
  is_pocketed: false,
  cluster: { id: 1, name: "Culinary", icon: "utensils" },
  category: { id: 2, name: "Cafe" },
  specialty_tags: [],
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
};

function collectionState(overrides: Record<string, unknown> = {}) {
  return {
    businesses: [business],
    totalItems: 1,
    isLoading: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isRefetching: false,
    fetchNextPage: mockFetchNextPage,
    refetch: mockRefetch,
    ...overrides,
  };
}

describe("ExploreCollectionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollectionType = "hidden-gems";
    (useExploreCollection as jest.Mock).mockReturnValue(collectionState());
  });

  it.each([
    ["hidden-gems", "Hidden Gems"],
    ["interests", "Based on Your Interests"],
    ["new-businesses", "New to SugboGo"],
  ])("renders the %s collection title", async (type, title) => {
    mockCollectionType = type;
    const screen = await render(<ExploreCollectionScreen />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(screen.getByText("1 place")).toBeTruthy();
  });

  it("reuses cards, navigates to profiles, and wires impression timing", async () => {
    const screen = await render(<ExploreCollectionScreen />);

    fireEvent.press(screen.getByTestId("collection-card-42"));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/(explorer)/business/[businessId]",
        params: expect.objectContaining({ businessId: "42" }),
      }),
    );
    expect(
      screen.getByTestId("explore-collection-list").props
        .onViewableItemsChanged,
    ).toBe(mockOnViewableItemsChanged);
  });

  it("shows an initial loading state", async () => {
    (useExploreCollection as jest.Mock).mockReturnValue(
      collectionState({
        businesses: [],
        totalItems: 0,
        isLoading: true,
      }),
    );
    const loading = await render(<ExploreCollectionScreen />);
    expect(loading.getByTestId("collection-loading")).toBeTruthy();
  });

  it("shows a persistent error with Retry", async () => {
    (useExploreCollection as jest.Mock).mockReturnValue(
      collectionState({ businesses: [], error: new Error("Offline") }),
    );
    const error = await render(<ExploreCollectionScreen />);
    fireEvent.press(error.getByText("Retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows a successful filtered-empty state", async () => {
    (useExploreCollection as jest.Mock).mockReturnValue(
      collectionState({ businesses: [], totalItems: 0 }),
    );
    const empty = await render(<ExploreCollectionScreen />);
    expect(empty.getByTestId("collection-empty")).toBeTruthy();
  });

  it("guards pagination requests and refreshes only the active collection", async () => {
    (useExploreCollection as jest.Mock).mockReturnValue(
      collectionState({ hasNextPage: true }),
    );
    const screen = await render(<ExploreCollectionScreen />);
    const list = screen.getByTestId("explore-collection-list");

    list.props.onEndReached();
    list.props.refreshControl.props.onRefresh();

    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("applies taxonomy-only draft filters to the active collection", async () => {
    const screen = await render(<ExploreCollectionScreen />);

    fireEvent.press(screen.getByText("Draft taxonomy filters"));
    await waitFor(() => {
      expect(screen.getByText("Draft categories: 7,4")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Apply taxonomy filters"));

    await waitFor(() => {
      expect(useExploreCollection).toHaveBeenLastCalledWith(
        "hidden-gems",
        expect.objectContaining({
          search: "",
          clusterId: 1,
          categoryIds: [7, 4],
          specialtyTagId: 12,
        }),
      );
    });
  });

  it("clears applied Categories but preserves Specialty when Cluster is removed", async () => {
    const screen = await render(<ExploreCollectionScreen />);

    fireEvent.press(screen.getByText("Draft taxonomy filters"));
    await waitFor(() => {
      expect(screen.getByText("Draft categories: 7,4")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Apply taxonomy filters"));
    await waitFor(() => {
      expect(screen.getByLabelText("Remove Food filter")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Remove Food filter"));

    await waitFor(() => {
      expect(useExploreCollection).toHaveBeenLastCalledWith(
        "hidden-gems",
        expect.objectContaining({
          clusterId: null,
          categoryIds: [],
          specialtyTagId: 12,
        }),
      );
    });
  });
});
