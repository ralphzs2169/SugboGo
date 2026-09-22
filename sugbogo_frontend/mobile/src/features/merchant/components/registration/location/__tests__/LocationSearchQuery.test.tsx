import { act, fireEvent, render } from "@testing-library/react-native";

import useRegistrationPlaceSearch from "@/features/merchant/hooks/registration/useRegistrationPlaceSearch";
import LocationSearch from "../LocationSearch";
import SearchResults from "../SearchResults";

const mockGetPlaceDetails = jest.fn();
const mockSearchPlaces = jest.fn();
const mockClearSuggestions = jest.fn();

let mockPlaceSearchState = {
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

jest.mock("@/features/merchant/hooks/registration/useRegistrationPlaceSearch", () => ({
  __esModule: true,
  default: jest.fn(() => mockPlaceSearchState),
}));
jest.mock("../SearchBar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("../SearchResults", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

describe("LocationSearch place-detail selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaceSearchState = {
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

  it("shows resolving state only for the selected row", async () => {
    let resolveDetails: (value: null) => void = () => undefined;
    mockGetPlaceDetails.mockReturnValue(
      new Promise<null>((resolve) => { resolveDetails = resolve; }),
    );
    const onPlaceSelect = jest.fn();
    const screen = await render(
      <LocationSearch
        value="Cebu"
        onChangeText={jest.fn()}
        onPlaceSelect={onPlaceSelect}
      />,
    );
    const searchResults = SearchResults as jest.Mock;
    const handleSelect = searchResults.mock.lastCall[0].onPlaceSelect;

    await act(async () => {
      void handleSelect("place-2");
      await Promise.resolve();
    });

    expect(mockGetPlaceDetails).toHaveBeenCalledWith("place-2");
    expect(searchResults.mock.lastCall[0].resolvingPlaceId).toBe("place-2");
    expect(useRegistrationPlaceSearch).toHaveBeenCalled();

    await act(async () => { resolveDetails(null); });
    expect(searchResults.mock.lastCall[0].resolvingPlaceId).toBeNull();
    expect(onPlaceSelect).not.toHaveBeenCalled();
    screen.unmount();
  });

  it("does not show a no-results state for a generic search failure", async () => {
    mockPlaceSearchState.suggestions = [];
    mockPlaceSearchState.isSearchSuccess = false;
    mockPlaceSearchState.searchError = new Error("Search unavailable");

    const screen = await render(
      <LocationSearch
        value="Cebu"
        onChangeText={jest.fn()}
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(SearchResults).toHaveBeenLastCalledWith(
      expect.objectContaining({ showNoResults: false }),
      undefined,
    );
    expect(screen.getByText("Unable to search places.")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry"));
    expect(mockSearchPlaces).toHaveBeenCalledWith("Cebu");
  });

  it("shows an empty result only after a successful search", async () => {
    mockPlaceSearchState.suggestions = [];

    const screen = await render(
      <LocationSearch
        value="Cebu"
        onChangeText={jest.fn()}
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(SearchResults).toHaveBeenLastCalledWith(
      expect.objectContaining({ showNoResults: true }),
      undefined,
    );
    screen.unmount();
  });

  it("does not show a premature empty result during debounce", async () => {
    mockPlaceSearchState.suggestions = [];
    mockPlaceSearchState.isDebouncing = true;
    mockPlaceSearchState.isSearchSuccess = false;

    const screen = await render(
      <LocationSearch
        value="Cebu"
        onChangeText={jest.fn()}
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(SearchResults).toHaveBeenLastCalledWith(
      expect.objectContaining({ showNoResults: false }),
      undefined,
    );
    screen.unmount();
  });
});
