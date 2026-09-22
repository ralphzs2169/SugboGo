import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import useRegistrationPlaceSearch from "@/features/merchant/hooks/registration/useRegistrationPlaceSearch";
import type { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import BusinessLocationSearchSheet from "../BusinessLocationSearchSheet";

const mockSearchPlaces = jest.fn();
const mockGetPlaceDetails = jest.fn();
const mockClearSuggestions = jest.fn();
const mockDismiss = jest.fn();

let mockSearchState = {
  suggestions: [
    { placeId: "place-1", mainText: "First", secondaryText: "Cebu" },
    { placeId: "place-2", mainText: "Second", secondaryText: "Cebu" },
  ],
  isLoading: false,
  isDebouncing: false,
  isSearchSuccess: true,
  searchError: null as Error | null,
  isSearchRateLimited: false,
  searchPlaces: mockSearchPlaces,
  getPlaceDetails: mockGetPlaceDetails,
  clearSuggestions: mockClearSuggestions,
};

jest.mock(
  "@/features/merchant/hooks/registration/useRegistrationPlaceSearch",
  () => ({
    __esModule: true,
    default: jest.fn(() => mockSearchState),
  }),
);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { ScrollView, TextInput, View } = jest.requireActual("react-native");

  return {
    BottomSheetModal: React.forwardRef(function MockBottomSheetModal(
      {
        children,
        onChange,
        onDismiss,
      }: {
        children: React.ReactNode;
        onChange?: (index: number) => void;
        onDismiss?: () => void;
      },
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        present: () => onChange?.(0),
        dismiss: () => {
          mockDismiss();
          onChange?.(-1);
          onDismiss?.();
        },
      }));

      return <View>{children}</View>;
    }),
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: ScrollView,
    BottomSheetTextInput: TextInput,
  };
});

const selectedLocation: BusinessLocation = {
  latitude: 10.32,
  longitude: 123.89,
  formattedAddress: "Selected place",
  province: "Cebu",
  city: "Cebu City",
  barangay: "Lahug",
  streetAddress: "Place street",
  isWithinServiceArea: true,
};

describe("BusinessLocationSearchSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchState = {
      suggestions: [
        { placeId: "place-1", mainText: "First", secondaryText: "Cebu" },
        { placeId: "place-2", mainText: "Second", secondaryText: "Cebu" },
      ],
      isLoading: false,
      isDebouncing: false,
      isSearchSuccess: true,
      searchError: null,
      isSearchRateLimited: false,
      searchPlaces: mockSearchPlaces,
      getPlaceDetails: mockGetPlaceDetails,
      clearSuggestions: mockClearSuggestions,
    };
  });

  async function renderSheet() {
    const sheetRef = React.createRef<BottomSheetModal>();
    const onPlaceSelect = jest.fn();
    const screen = await render(
      <BusinessLocationSearchSheet
        sheetRef={sheetRef}
        onPlaceSelect={onPlaceSelect}
      />,
    );

    return { screen, sheetRef, onPlaceSelect };
  }

  it("keeps short input in the initial state and clears temporary search on dismiss", async () => {
    const { screen, sheetRef } = await renderSheet();
    const input = screen.getByLabelText("Search your business location");

    await act(async () => fireEvent.changeText(input, "C"));
    expect(screen.getByText(/at least two characters/)).toBeTruthy();
    expect(screen.queryByText("No matching places found")).toBeNull();

    await act(async () => sheetRef.current?.dismiss());
    expect(mockClearSuggestions).toHaveBeenCalled();
    expect(input.props.value).toBe("");
    screen.unmount();
  });

  it("does not show an empty result while a valid query is debouncing or loading", async () => {
    mockSearchState.suggestions = [];
    mockSearchState.isSearchSuccess = false;
    mockSearchState.isDebouncing = true;
    const { screen, sheetRef, onPlaceSelect } = await renderSheet();

    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );
    expect(mockSearchPlaces).toHaveBeenCalledWith("Cebu");
    expect(screen.getByText("Searching places...")).toBeTruthy();
    expect(screen.queryByText("No matching places found")).toBeNull();

    mockSearchState.isDebouncing = false;
    mockSearchState.isLoading = true;
    await act(async () => {
      screen.rerender(
        <BusinessLocationSearchSheet
          sheetRef={sheetRef}
          onPlaceSelect={onPlaceSelect}
        />,
      );
    });
    expect(screen.queryByText("No matching places found")).toBeNull();
    screen.unmount();
  });

  it("shows an empty state only for a successful search with no results", async () => {
    mockSearchState.suggestions = [];
    const { screen } = await renderSheet();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );
    expect(screen.getByText("No matching places found")).toBeTruthy();
    screen.unmount();
  });

  it("shows a retry action for a generic search failure", async () => {
    mockSearchState.suggestions = [];
    mockSearchState.isSearchSuccess = false;
    mockSearchState.searchError = new Error("Search unavailable");
    const { screen } = await renderSheet();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );
    expect(screen.queryByText("No matching places found")).toBeNull();
    await act(async () => fireEvent.press(screen.getByText("Try again")));
    expect(mockSearchPlaces).toHaveBeenLastCalledWith("Cebu");
    screen.unmount();
  });

  it("shows rate-limit feedback instead of an empty state", async () => {
    mockSearchState.suggestions = [];
    mockSearchState.isSearchSuccess = false;
    mockSearchState.isSearchRateLimited = true;
    const { screen } = await renderSheet();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );
    expect(screen.getByText("You're searching too quickly.")).toBeTruthy();
    expect(screen.queryByText("No matching places found")).toBeNull();
    screen.unmount();
  });

  it("resolves only the selected row, passes its location up, and dismisses", async () => {
    let resolveDetails: (value: BusinessLocation | null) => void = () =>
      undefined;
    mockGetPlaceDetails.mockReturnValue(
      new Promise((resolve) => {
        resolveDetails = resolve;
      }),
    );
    const { screen, sheetRef, onPlaceSelect } = await renderSheet();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Select Second"));
      await Promise.resolve();
    });
    expect(mockGetPlaceDetails).toHaveBeenCalledWith("place-2");
    expect(
      screen.getByLabelText("Select Second").props.accessibilityState.busy,
    ).toBe(true);
    expect(
      screen.getByLabelText("Select First").props.accessibilityState.busy,
    ).toBe(false);

    await act(async () => resolveDetails(selectedLocation));
    expect(onPlaceSelect).toHaveBeenCalledWith(selectedLocation);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockClearSuggestions).toHaveBeenCalled();
    expect(sheetRef.current).toBeTruthy();
    screen.unmount();
  });

  it("keeps the sheet open when place details cannot be resolved", async () => {
    mockGetPlaceDetails.mockResolvedValue(null);
    const { screen } = await renderSheet();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText("Search your business location"),
        "Cebu",
      ),
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Select First"));
    });
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("Select First").props.accessibilityState.busy,
    ).toBe(false);
    screen.unmount();
  });

  it("consumes hardware Back only while the search sheet is open", async () => {
    let handleBack: (() => boolean) | undefined;
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_, handler) => {
        handleBack = () => Boolean(handler({} as never));
        return { remove: jest.fn() };
      });
    const { screen, sheetRef } = await renderSheet();

    await act(async () => Promise.resolve());
    expect(handleBack?.()).toBe(false);
    await act(async () => sheetRef.current?.present());
    expect(handleBack?.()).toBe(true);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(handleBack?.()).toBe(false);
    jest.restoreAllMocks();
    expect(useRegistrationPlaceSearch).toHaveBeenCalled();
    screen.unmount();
  });
});
