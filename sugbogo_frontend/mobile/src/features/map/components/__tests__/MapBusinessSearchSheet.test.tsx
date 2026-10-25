import React, { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import useMapBusinessSearch from "../../hooks/useMapBusinessSearch";
import MapBusinessSearchSheet from "../MapBusinessSearchSheet";

const mockSearchState = {
  businesses: [] as { id: number; business_name: string }[],
  hasQuery: false,
  totalItems: 0,
  highlightQuery: "",
  usedFuzzyFallback: false,
  isPending: false,
  isFetching: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  error: null as unknown,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
};
const mockDismiss = jest.fn();
const mockCardHighlight = jest.fn();
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/explore/stores/recentSearches.store", () => ({
  useRecentSearchesStore: () => ({
    queries: [],
    scope: "test",
    isHydrated: true,
    addQuery: jest.fn(),
    removeQuery: jest.fn(),
    clearQueries: jest.fn(),
  }),
}));
jest.mock("@/features/explore/hooks/useVisibilityMutations", () => ({
  useRecordBusinessImpressions: () => ({ mutateAsync: jest.fn() }),
}));
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
    useAnimatedReaction: jest.fn(),
  };
});
jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));
jest.mock("../../hooks/useMapBusinessSearch", () => ({
  __esModule: true,
  default: jest.fn(() => mockSearchState),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("@/features/explore/components/new-businesses/BusinessCard", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function MockBusinessCard({
    business,
    onPress,
    highlightQuery,
  }: {
    business: { business_name: string };
    onPress: () => void;
    highlightQuery?: string;
  }) {
    mockCardHighlight(highlightQuery);
    return (
      <Pressable onPress={onPress}>
        <Text>{business.business_name}</Text>
      </Pressable>
    );
  };
});
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { View, TextInput } = jest.requireActual("react-native");
  return {
    useBottomSheetInternal: () => ({}),
    ANIMATION_STATUS: { RUNNING: 1, STOPPED: 2 },
    BottomSheetModal: React.forwardRef(function MockSheet(
      {
        children,
        onChange,
        onDismiss,
      }: {
        children: React.ReactNode;
        onChange: (index: number) => void;
        onDismiss: () => void;
      },
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        present: () => onChange(0),
        dismiss: () => {
          mockDismiss();
          onChange(-1);
          onDismiss();
        },
      }));
      return <View>{children}</View>;
    }),
    BottomSheetTextInput: TextInput,
    BottomSheetFlatList: function MockBusinessList({
      data,
      renderItem,
      ListEmptyComponent,
      ListFooterComponent,
      ListHeaderComponent,
    }: {
      data: { id: number }[];
      renderItem: (info: { item: { id: number } }) => React.ReactNode;
      ListEmptyComponent: React.ReactNode;
      ListFooterComponent: React.ReactNode;
      ListHeaderComponent: React.ReactNode;
    }) {
      return (
        <View>
          {ListHeaderComponent}
          {data.length > 0
            ? data.map((item) => (
                <React.Fragment key={item.id}>
                  {renderItem({ item })}
                </React.Fragment>
              ))
            : ListEmptyComponent}
          {ListFooterComponent}
        </View>
      );
    },
    BottomSheetBackdrop: () => null,
  };
});

beforeEach(() => {
  mockSearchState.businesses = [];
  mockSearchState.error = null;
  mockSearchState.isPending = false;
  mockSearchState.hasQuery = false;
  mockSearchState.highlightQuery = "";
  mockSearchState.usedFuzzyFallback = false;
  mockSearchState.totalItems = 0;
});

async function setup() {
  const sheetRef = createRef<BottomSheetModal>();
  const onBusinessSelect = jest.fn();
  const screen = await render(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  await act(async () => {
    sheetRef.current?.present();
  });
  return { screen, sheetRef, onBusinessSelect };
}

it("opens search and clears typed text on explicit dismissal", async () => {
  const { screen } = await setup();
  expect(useMapBusinessSearch).toHaveBeenLastCalledWith("", true);
  await fireEvent.changeText(
    screen.getByLabelText("Search SugboGo businesses"),
    "coffee",
  );
  expect(useMapBusinessSearch).toHaveBeenLastCalledWith("coffee", true);
  await fireEvent.press(
    screen.getByRole("button", { name: "Close business search" }),
  );
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(useMapBusinessSearch).toHaveBeenLastCalledWith("", false);
});

it("dismisses before selecting a registered business and guards repeat taps", async () => {
  mockSearchState.businesses = [{ id: 42, business_name: "Registered Cafe" }];
  const { screen, onBusinessSelect } = await setup();
  await fireEvent.press(screen.getByText("Registered Cafe"));
  await fireEvent.press(screen.getByText("Registered Cafe"));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(onBusinessSelect).toHaveBeenCalledTimes(1);
  expect(onBusinessSelect).toHaveBeenCalledWith(mockSearchState.businesses[0]);
});

it("keeps loading, empty, and retryable failure states distinct", async () => {
  mockSearchState.hasQuery = true;
  mockSearchState.isPending = true;
  const { screen, sheetRef, onBusinessSelect } = await setup();
  expect(screen.getByTestId("search-filter-results-loading")).toBeTruthy();
  expect(screen.queryByText("No places found")).toBeNull();
  mockSearchState.isPending = false;
  await screen.rerender(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  expect(screen.getByText("No places found")).toBeTruthy();
  mockSearchState.error = { code: "NETWORK_ERROR" };
  await screen.rerender(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockSearchState.refetch).toHaveBeenCalledTimes(1);
});

it("shares settled highlighting and shows the cue only for confirmed populated fuzzy results", async () => {
  mockSearchState.hasQuery = true;
  mockSearchState.totalItems = 1;
  mockSearchState.businesses = [{ id: 42, business_name: "Adventure" }];
  mockSearchState.highlightQuery = "advventre";
  mockSearchState.usedFuzzyFallback = true;
  const { screen, sheetRef, onBusinessSelect } = await setup();
  expect(screen.getByText("Showing similar matches")).toBeTruthy();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("advventre");

  mockSearchState.isPending = true;
  mockSearchState.highlightQuery = "";
  await screen.rerender(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  expect(screen.queryByText("Showing similar matches")).toBeNull();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("");

  mockSearchState.isPending = false;
  mockSearchState.usedFuzzyFallback = false;
  mockSearchState.highlightQuery = "coffee";
  await screen.rerender(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  expect(screen.queryByText("Showing similar matches")).toBeNull();
  expect(mockCardHighlight).toHaveBeenLastCalledWith("coffee");

  mockSearchState.usedFuzzyFallback = true;
  mockSearchState.businesses = [];
  mockSearchState.totalItems = 0;
  await screen.rerender(
    <MapBusinessSearchSheet
      sheetRef={sheetRef}
      onBusinessSelect={onBusinessSelect}
    />,
  );
  expect(screen.queryByText("Showing similar matches")).toBeNull();
  expect(screen.getByText("No places found")).toBeTruthy();
});

it("consumes Android Back only while search is open", async () => {
  let handler = () => false;
  const subscription = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      handler = listener as () => boolean;
      return { remove: jest.fn() };
    });
  const { screen } = await setup();
  await act(async () => {
    expect(handler()).toBe(true);
  });
  expect(handler()).toBe(false);
  await screen.unmount();
  subscription.mockRestore();
});
