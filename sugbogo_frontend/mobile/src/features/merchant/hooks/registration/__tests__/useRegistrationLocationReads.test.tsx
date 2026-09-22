import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import {
  getPlaceDetails,
  reverseGeocode,
  searchPlaces,
} from "@/shared/api/googlePlaces.service";
import { merchantApplicationKeys } from "../../merchantApplicationQueryKeys";
import useRegistrationPlaceSearch from "../useRegistrationPlaceSearch";
import useRegistrationReverseGeocode from "../useRegistrationReverseGeocode";

jest.mock("@/shared/api/googlePlaces.service", () => ({
  getPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(),
  searchPlaces: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const suggestions = [{
  placeId: "place-1",
  mainText: "Cebu City",
  secondaryText: "Cebu",
}];

const location = {
  latitude: 10.3157,
  longitude: 123.8854,
  formattedAddress: "Cebu City",
  province: "Cebu",
  city: "Cebu City",
  barangay: "Lahug",
  streetAddress: "Gorordo Avenue",
  isWithinServiceArea: true,
};

async function finishDebounce() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 370));
  });
}

describe("registration location queries", () => {
  beforeEach(() => jest.clearAllMocks());

  it("debounces search, disables short input, and clears results", async () => {
    (searchPlaces as jest.Mock).mockResolvedValue({
      success: true,
      message: "Found places.",
      data: { suggestions },
    });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => { result.current.searchPlaces("C"); });
    expect(searchPlaces).not.toHaveBeenCalled();

    await act(async () => { result.current.searchPlaces("  Cebu  "); });
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isDebouncing).toBe(true);
    expect(result.current.isSearchSuccess).toBe(false);

    await finishDebounce();
    await waitFor(() => expect(result.current.suggestions).toEqual(suggestions));
    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.isSearchSuccess).toBe(true);
    expect(searchPlaces).toHaveBeenCalledWith("Cebu");
    expect(client.getQueryData(merchantApplicationKeys.placeSearch("Cebu")))
      .toEqual(suggestions);

    await act(async () => { result.current.clearSuggestions(); });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.isSearchRateLimited).toBe(false);

    unmount();
    client.clear();
  });

  it("keeps older search responses from replacing the current term", async () => {
    let resolveOld: (value: unknown) => void = () => undefined;
    const oldSearch = new Promise((resolve) => { resolveOld = resolve; });
    (searchPlaces as jest.Mock)
      .mockReturnValueOnce(oldSearch)
      .mockResolvedValueOnce({
        success: true,
        message: "Found places.",
        data: { suggestions: [{ ...suggestions[0], placeId: "place-2" }] },
      });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => { result.current.searchPlaces("Cebu"); });
    await finishDebounce();
    await waitFor(() => expect(searchPlaces).toHaveBeenCalledTimes(1));
    await act(async () => { result.current.searchPlaces("Manila"); });
    await finishDebounce();
    await waitFor(() => expect(result.current.suggestions[0]?.placeId).toBe("place-2"));

    resolveOld({
      success: true,
      message: "Old results.",
      data: { suggestions },
    });
    await act(async () => { await oldSearch; });
    expect(result.current.suggestions[0]?.placeId).toBe("place-2");

    unmount();
    client.clear();
  });

  it("reuses cached search data and exposes rate-limit errors", async () => {
    (searchPlaces as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Found places.",
        data: { suggestions },
      })
      .mockResolvedValueOnce({
        success: false,
        message: "Too many searches.",
        code: "RATE_LIMIT_EXCEEDED",
      });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => { result.current.searchPlaces("Cebu"); });
    await finishDebounce();
    await waitFor(() => expect(result.current.suggestions).toEqual(suggestions));
    await act(async () => { result.current.searchPlaces("Manila"); });
    await finishDebounce();
    await waitFor(() => expect(result.current.isSearchRateLimited).toBe(true));
    expect(result.current.suggestions).toEqual([]);
    await act(async () => { result.current.searchPlaces("Cebu"); });
    await finishDebounce();
    await waitFor(() => expect(result.current.suggestions).toEqual(suggestions));
    expect(searchPlaces).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });

  it("exposes a search API error and retries the same term on request", async () => {
    (searchPlaces as jest.Mock)
      .mockResolvedValueOnce({
        success: false,
        message: "Search unavailable.",
        code: "NETWORK_ERROR",
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Found places.",
        data: { suggestions },
      });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => { result.current.searchPlaces("Cebu"); });
    await finishDebounce();
    await waitFor(() =>
      expect(result.current.error).toBe("Unable to search places."),
    );
    expect(result.current.suggestions).toEqual([]);

    await act(async () => { result.current.searchPlaces("Cebu"); });
    await finishDebounce();
    await waitFor(() => expect(result.current.suggestions).toEqual(suggestions));
    expect(searchPlaces).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });

  it("fetches details only for selected IDs and reuses the keyed result", async () => {
    (getPlaceDetails as jest.Mock).mockResolvedValue({
      success: true,
      message: "Place resolved.",
      data: { location },
    });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });
    expect(getPlaceDetails).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.getPlaceDetails("place-1"))
        .resolves.toEqual(location);
      await expect(result.current.getPlaceDetails("place-1"))
        .resolves.toEqual(location);
    });
    expect(getPlaceDetails).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(merchantApplicationKeys.placeDetails("place-1")))
      .toEqual(location);

    unmount();
    client.clear();
  });

  it("preserves place-detail rate-limit feedback", async () => {
    (getPlaceDetails as jest.Mock).mockResolvedValue({
      success: false,
      message: "Rate limited.",
      code: "RATE_LIMIT_EXCEEDED",
      errors: { retry_after: 4 },
    });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.getPlaceDetails("place-1"))
        .resolves.toBeNull();
    });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        text1: "You're selecting places too quickly",
      }),
    );
    expect(client.getQueryState(merchantApplicationKeys.placeDetails("place-1"))?.error)
      .toEqual(expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }));

    unmount();
    client.clear();
  });

  it("shows feedback for a generic place-detail failure", async () => {
    (getPlaceDetails as jest.Mock).mockResolvedValue({
      success: false,
      message: "Place details unavailable.",
      code: "PLACE_DETAILS_UNAVAILABLE",
    });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationPlaceSearch, {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.getPlaceDetails("place-1"))
        .resolves.toBeNull();
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        text1: "Unable to load place details",
      }),
    );

    unmount();
    client.clear();
  });

  it("keys reverse geocoding by exact coordinates, caches success, and does not retry API errors", async () => {
    (reverseGeocode as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Address resolved.",
        data: { address: location, is_within_service_area: true },
      })
      .mockResolvedValueOnce({
        success: false,
        message: "Rate limited.",
        code: "RATE_LIMIT_EXCEEDED",
      });
    const client = createClient();
    const { result, unmount } = await renderHook(useRegistrationReverseGeocode, {
      wrapper: createWrapper(client),
    });
    expect(reverseGeocode).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.resolveCoordinates(10.3157, 123.8854);
      await result.current.resolveCoordinates(10.3157, 123.8854);
    });
    expect(reverseGeocode).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(merchantApplicationKeys.reverseGeocode(10.3157, 123.8854)))
      .toEqual({ address: location, is_within_service_area: true });

    await act(async () => {
      await expect(result.current.resolveCoordinates(10.3158, 123.8855))
        .rejects.toEqual(expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }));
    });
    expect(reverseGeocode).toHaveBeenCalledTimes(2);
    await expect(result.current.resolveCoordinates(NaN, 123.8855))
      .rejects.toThrow("coordinates are unavailable");
    expect(reverseGeocode).toHaveBeenCalledTimes(2);

    unmount();
    client.clear();
  });
});
