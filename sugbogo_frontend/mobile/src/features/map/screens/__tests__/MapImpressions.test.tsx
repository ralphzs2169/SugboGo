import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { AppState, Keyboard, type AppStateStatus } from "react-native";
import { router } from "expo-router";

import MapScreen from "../MapScreen";
import type { ExploreBusiness } from "@/features/explore/types/exploreBusiness.types";

const mockSubmit = jest.fn();
let mockFocused = true;
let mockPreviewRect = [16, 500, 368, 200];
let mockPositionReaction: {
  prepare: () => boolean;
  react: (value: boolean, previous: boolean | null) => void;
};
const mockAppListeners = new Set<(state: AppStateStatus) => void>();
const mockKeyboardListeners = new Map<string, () => void>();

const mockBusinesses = [1, 2].map((id) => ({
  id,
  business_name: `Map business ${id}`,
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
  is_pocketed: false,
  is_hidden_gem: false,
  category: { id: 1, name: "Cafe" },
  cluster: { id: 1, name: "Culinary", icon: "coffee" },
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.3,
    longitude: 123.9,
  },
  specialty_tags: [],
}));
let mockSearchBusinesses = mockBusinesses;

jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const MeasuredView = React.forwardRef(function MeasuredView(
    props: { testID?: string },
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      measureLayout: (
        _ancestor: unknown,
        success: (...rect: number[]) => void,
      ) => {
        if (props.testID === "business-preview-anchor")
          success(...mockPreviewRect);
      },
    }));
    return <native.View {...props} />;
  });
  return new Proxy(native, {
    get: (target, key) =>
      key === "View" ? MeasuredView : Reflect.get(target, key),
  });
});
jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ isFocused: () => mockFocused }),
  router: { push: jest.fn() },
}));
jest.mock("@/features/explore/hooks/useVisibilityMutations", () => ({
  useRecordBusinessImpressions: () => ({ mutateAsync: mockSubmit }),
}));
jest.mock("../../hooks/useMapDirectory", () => ({
  __esModule: true,
  default: () => ({ businesses: mockBusinesses, selectionResolved: true }),
}));
jest.mock("../../hooks/useMapBusinessSearch", () => ({
  __esModule: true,
  default: () => ({ businesses: mockSearchBusinesses, hasQuery: true }),
}));
jest.mock("@/features/explore/hooks/useExploreFilterOptions", () => ({
  __esModule: true,
  default: () => ({
    options: { clusters: [], categories: [], specialty_tags: [] },
  }),
}));
jest.mock("@/shared/hooks/useUserLocation", () => ({
  __esModule: true,
  default: () => ({ status: "denied", location: null }),
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 80,
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("../../components/BusinessDiscoveryMap", () => {
  const { View } = jest.requireActual("react-native");
  return function DiscoveryMap(props: object) {
    return <View testID="discovery-map" {...props} />;
  };
});
jest.mock("../../components/MapSearchOverlay", () => {
  const { View } = jest.requireActual("react-native");
  return function MapOverlay(props: object) {
    return <View testID="map-overlay" {...props} />;
  };
});
jest.mock("../../components/MapControls", () => () => null);
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: React.RefObject<{ present: () => void }>) =>
    ref.current?.present(),
}));
jest.mock(
  "@/features/explore/components/search-filter-results/SearchFilterBottomSheet",
  () => {
    const React = jest.requireActual("react");
    const { View } = jest.requireActual("react-native");
    return function FilterSheet(props: {
      sheetRef: React.Ref<unknown>;
      onDismiss: () => void;
    }) {
      React.useImperativeHandle(props.sheetRef, () => ({
        present: jest.fn(),
        dismiss: props.onDismiss,
      }));
      return <View testID="filter-sheet" onDismiss={props.onDismiss} />;
    };
  },
);
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  return {
    useSharedValue: (value: number) =>
      React.useRef({
        value,
        get() {
          return this.value;
        },
        set(next: number) {
          this.value = next;
        },
      }).current,
    useAnimatedReaction: (
      prepare: () => boolean,
      react: (value: boolean, previous: boolean | null) => void,
    ) => {
      React.useLayoutEffect(() => {
        mockPositionReaction = { prepare, react };
      });
    },
  };
});
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock("@/features/explore/components/new-businesses/BusinessCard", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function SearchBusinessCard({
    business,
    onPress,
  }: {
    business: ExploreBusiness;
    onPress: () => void;
  }) {
    return (
      <Pressable testID={`search-business-${business.id}`} onPress={onPress}>
        <Text>{business.business_name}</Text>
      </Pressable>
    );
  };
});
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { View, TextInput } = jest.requireActual("react-native");
  return {
    BottomSheetModal: React.forwardRef(function Sheet(
      props: any,
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        present: () => props.onAnimate(-1, 0, 800, 48),
        dismiss: () => {
          props.onAnimate(0, -1, 48, 800);
          props.onChange(-1, 800);
          props.onDismiss();
        },
      }));
      return <View testID="search-sheet" {...props} />;
    }),
    BottomSheetFlatList: ({ data, renderItem, ...props }: any) => (
      <View {...props}>
        {data.map((item: ExploreBusiness) => (
          <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
        ))}
      </View>
    ),
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: () => null,
  };
});

type Screen = Awaited<ReturnType<typeof render>>;

async function advance(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function layout(
  screen: Screen,
  id: string,
  width: number,
  height: number,
) {
  await fireEvent(screen.getByTestId(id), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
}

async function selectPreview(screen: Screen, id = 1) {
  await fireEvent(screen.getByTestId("map-overlay"), "headerLayout", 80);
  await fireEvent(screen.getByTestId("discovery-map"), "businessPress", id);
  await layout(screen, "map-impression-viewport", 400, 800);
  await layout(screen, "business-preview-anchor", 368, 200);
  await layout(screen, "map-preview-identity-viewport", 344, 100);
  await layout(screen, "map-preview-identity", 344, 80);
}

async function openSearch(screen: Screen) {
  await fireEvent(screen.getByTestId("map-overlay"), "search");
  await fireEvent(screen.getByTestId("search-sheet"), "change", 0, 48);
}

async function viewableResults(screen: Screen, ids: number[]) {
  const list = screen.getByTestId("map-business-search-results");
  expect(list.props.viewabilityConfig.itemVisiblePercentThreshold).toBe(50);
  // This is FlatList's native clipping contract, not a data-loading notification.
  await fireEvent(list, "viewableItemsChanged", {
    viewableItems: mockSearchBusinesses.map((item, index) => ({
      item,
      index,
      key: String(item.id),
      isViewable: ids.includes(item.id),
    })),
  });
}

async function scrollSearchResults(
  screen: Screen,
  offset: number,
  viewportHeight: number,
) {
  const ViewabilityHelper = jest.requireActual(
    "@react-native/virtualized-lists/Lists/ViewabilityHelper",
  ).default;
  const config = screen.getByTestId("map-business-search-results").props
    .viewabilityConfig;
  const helper = new ViewabilityHelper(config);
  const indices = helper.computeViewableItems(
    {
      data: mockSearchBusinesses,
      getItemCount: (data: ExploreBusiness[]) => data.length,
    },
    offset,
    viewportHeight,
    {
      getCellMetrics: (index: number) => ({
        index,
        offset: index * 100,
        length: 100,
      }),
    },
  );
  await viewableResults(
    screen,
    indices.map((index: number) => mockSearchBusinesses[index].id),
  );
  helper.dispose();
}

describe("map impressions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSubmit.mockReset().mockResolvedValue(undefined);
    mockFocused = true;
    mockPreviewRect = [16, 500, 368, 200];
    mockSearchBusinesses = mockBusinesses;
    AppState.currentState = "active";
    mockAppListeners.clear();
    mockKeyboardListeners.clear();
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
    jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation((event, callback) => {
      mockKeyboardListeners.set(event, () => callback({} as Parameters<typeof callback>[0]));
        return { remove: () => mockKeyboardListeners.delete(event) };
      });
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, callback) => {
        mockAppListeners.add(callback);
        return { remove: () => mockAppListeners.delete(callback) };
      });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("records only visible search results after dwell and batching", async () => {
    const screen = await render(<MapScreen />);
    await viewableResults(screen, [1]);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await openSearch(screen);
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(1);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(750);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("excludes clipped search results and cancels a rapid scroll", async () => {
    const screen = await render(<MapScreen />);
    await openSearch(screen);
    await scrollSearchResults(screen, 0, 49);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await scrollSearchResults(screen, 100, 50);
    await advance(499);
    await scrollSearchResults(screen, 200, 50);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await scrollSearchResults(screen, 100, 50);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);
  });

  it("cancels search dwell during transitions and dismissal", async () => {
    const screen = await render(<MapScreen />);
    await openSearch(screen);
    await viewableResults(screen, [1]);
    await advance(250);
    await fireEvent(
      screen.getByTestId("search-sheet"),
      "animate",
      0,
      -1,
      48,
      800,
    );
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId("search-sheet"), "dismiss");
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("pauses a held partial sheet drag until its position is settled", async () => {
    const screen = await render(<MapScreen />);
    await openSearch(screen);
    await viewableResults(screen, [1]);
    await advance(250);
    const sheet = screen.getByTestId("search-sheet");
    await act(async () => {
      sheet.props.animatedPosition.value = 300;
      mockPositionReaction.react(mockPositionReaction.prepare(), true);
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await act(async () => {
      sheet.props.animatedPosition.value = 48;
      mockPositionReaction.react(mockPositionReaction.prepare(), false);
    });
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("prunes changed search results and preserves deduplication on rerenders", async () => {
    const screen = await render(<MapScreen />);
    await openSearch(screen);
    await viewableResults(screen, [1]);
    await advance(250);
    mockSearchBusinesses = [mockBusinesses[1]];
    await screen.rerender(<MapScreen />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await viewableResults(screen, [2]);
    await advance(1250);
    await screen.rerender(<MapScreen />);
    await viewableResults(screen, []);
    await viewableResults(screen, [2]);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);
  });

  it("records a measured selected preview and keeps profile navigation", async () => {
    const screen = await render(<MapScreen />);
    await selectPreview(screen);
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
    await fireEvent.press(
      screen.getByLabelText("View Map business 1 business profile"),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "1", profileSource: "MAP" },
    });
  });

  it("excludes clipped previews and previews with their identity scrolled away", async () => {
    const screen = await render(<MapScreen />);
    mockPreviewRect = [16, 650, 368, 200];
    await selectPreview(screen);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    mockPreviewRect = [16, 500, 368, 200];
    await layout(screen, "business-preview-anchor", 368, 200);
    await fireEvent.scroll(
      screen.getByTestId("map-preview-identity-viewport"),
      { nativeEvent: { contentOffset: { x: 0, y: 80 } } },
    );
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("excludes previews behind search and filters until dismissal", async () => {
    const screen = await render(<MapScreen />);
    await selectPreview(screen);
    await advance(250);
    await fireEvent(screen.getByTestId("map-overlay"), "search");
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId("search-sheet"), "dismiss");
    await advance(250);
    await fireEvent(screen.getByTestId("map-overlay"), "filters");
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId("filter-sheet"), "dismiss");
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("excludes identity behind the map header even when half the preview is visible", async () => {
    const screen = await render(<MapScreen />);
    await fireEvent(screen.getByTestId("map-overlay"), "headerLayout", 100);
    mockPreviewRect = [16, 0, 368, 200];
    await selectPreview(screen);
    await fireEvent(screen.getByTestId("map-overlay"), "headerLayout", 100);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    mockPreviewRect = [16, 150, 368, 200];
    await layout(screen, "business-preview-anchor", 368, 200);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("switches preview identity and excludes quick dismissal without duplicates", async () => {
    const screen = await render(<MapScreen />);
    await selectPreview(screen);
    await advance(250);
    await selectPreview(screen, 2);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);
    await screen.rerender(<MapScreen />);
    await selectPreview(screen, 2);
    await advance(1250);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await selectPreview(screen, 1);
    await advance(250);
    await fireEvent.press(screen.getByLabelText("Close business preview"));
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);
  });

  it("cancels both surfaces while unfocused or backgrounded", async () => {
    const screen = await render(<MapScreen />);
    await selectPreview(screen);
    await advance(250);
    mockFocused = false;
    await screen.rerender(<MapScreen />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    mockFocused = true;
    await screen.rerender(<MapScreen />);
    await openSearch(screen);
    await viewableResults(screen, [2]);
    await advance(250);
    await act(async () => {
      AppState.currentState = "background";
      mockAppListeners.forEach((callback) => callback("background"));
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await act(async () => {
      AppState.currentState = "active";
      mockAppListeners.forEach((callback) => callback("active"));
    });
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);
  });

  it("never records directory markers clusters or an unmeasured selection", async () => {
    const screen = await render(<MapScreen />);
    await layout(screen, "map-impression-viewport", 400, 800);
    const map = screen.getByTestId("discovery-map");
    await fireEvent(map, "viewportChange", {
      north: 11,
      south: 10,
      west: 123,
      east: 124,
    });
    await fireEvent(map, "mapInteraction");
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await fireEvent(map, "businessPress", 1);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("restarts search focus dwell and preview background dwell", async () => {
    const screen = await render(<MapScreen />);
    await openSearch(screen);
    await viewableResults(screen, [2]);
    await advance(250);
    mockFocused = false;
    await screen.rerender(<MapScreen />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    mockFocused = true;
    await screen.rerender(<MapScreen />);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[2]]]);

    await fireEvent(screen.getByTestId("search-sheet"), "dismiss");
    await selectPreview(screen);
    await advance(250);
    await act(async () => {
      AppState.currentState = "background";
      mockAppListeners.forEach((callback) => callback("background"));
    });
    await advance(1250);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      AppState.currentState = "active";
      mockAppListeners.forEach((callback) => callback("active"));
    });
    await advance(499);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[2]], [[1]]]);
  });

  it("waits for the search keyboard to hide before resuming preview dwell", async () => {
    const screen = await render(<MapScreen />);
    await selectPreview(screen);
    await advance(250);
    await act(async () => {
      mockKeyboardListeners.get("keyboardWillShow")?.();
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await act(async () => {
      mockKeyboardListeners.get("keyboardDidHide")?.();
    });
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });
});
