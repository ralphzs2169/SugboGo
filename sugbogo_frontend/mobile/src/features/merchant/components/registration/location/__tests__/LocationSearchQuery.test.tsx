import { act, render } from "@testing-library/react-native";

import useRegistrationPlaceSearch from "@/features/merchant/hooks/registration/useRegistrationPlaceSearch";
import LocationSearch from "../LocationSearch";
import SearchResults from "../SearchResults";

const mockGetPlaceDetails = jest.fn();

jest.mock("@/features/merchant/hooks/registration/useRegistrationPlaceSearch", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    suggestions: [
      { placeId: "place-1", mainText: "First", secondaryText: "Cebu" },
      { placeId: "place-2", mainText: "Second", secondaryText: "Cebu" },
    ],
    isLoading: false,
    isSearchRateLimited: false,
    searchPlaces: jest.fn(),
    getPlaceDetails: mockGetPlaceDetails,
    clearSuggestions: jest.fn(),
  })),
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
});
