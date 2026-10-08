import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import LocationChangeReviewSections from "../LocationChangeReviewSections";

jest.mock("../LocationChangeComparison", () => ({
  __esModule: true,
  default: () => {
    const { Text } = jest.requireActual("react-native");
    return <Text>Map preview</Text>;
  },
}));

const location = {
  latitude: 10.31,
  longitude: 123.88,
  address: "Old address",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};

const callbacks = {
  onViewCurrent: jest.fn(),
  onViewProposed: jest.fn(),
};

describe("Location change review sections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows address edits without an inline map", async () => {
    const screen = await render(
      <LocationChangeReviewSections
        currentLocation={location}
        proposedLocation={{ ...location, address: "New address" }}
        currentLandmarks={[]}
        proposedLandmarks={[]}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(screen.getByText("Currently live")).toBeTruthy();
    expect(screen.getByText("Old address")).toBeTruthy();
    expect(screen.getByText("Proposed")).toBeTruthy();
    expect(screen.getByText("New address")).toBeTruthy();
    expect(screen.queryByText("View location on map")).toBeNull();
    expect(screen.queryByText("Map preview")).toBeNull();
    await screen.unmount();
  });

  it("shows a map for a moved pin", async () => {
    const screen = await render(
      <LocationChangeReviewSections
        currentLocation={location}
        proposedLocation={{ ...location, latitude: 10.33 }}
        currentLandmarks={[]}
        proposedLandmarks={[]}
        {...callbacks}
      />,
    );

    expect(screen.getByText("New business pin")).toBeTruthy();
    expect(screen.getByText("Current business pin")).toBeTruthy();
    expect(screen.getByText("Map preview")).toBeTruthy();
    await screen.unmount();
  });

  it("shows landmark edits with map access and no inline map", async () => {
    const screen = await render(
      <LocationChangeReviewSections
        currentLocation={location}
        proposedLocation={location}
        currentLandmarks={[]}
        proposedLandmarks={[
          {
            id: "landmark-1",
            name: "Nearby cafe",
            address: "Cebu City",
            latitude: 10.32,
            longitude: 123.89,
            source: "google",
          },
        ]}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Landmark changes")).toBeTruthy();
    expect(screen.getByText("To be added (1)")).toBeTruthy();
    expect(screen.getByText("Nearby cafe")).toBeTruthy();
    expect(screen.getByText("Cebu City")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("View updated landmarks on map"));
    });
    expect(callbacks.onViewProposed).toHaveBeenCalled();
    expect(screen.queryByText("Map preview")).toBeNull();
    await screen.unmount();
  });

  it("separates removed landmarks from added landmarks", async () => {
    const screen = await render(
      <LocationChangeReviewSections
        currentLocation={location}
        proposedLocation={location}
        currentLandmarks={[
          {
            id: 1,
            name: "Old landmark",
            address: "Colon Street",
            latitude: 10.3,
            longitude: 123.88,
            source: "custom",
            place_id: null,
          },
        ]}
        proposedLandmarks={[
          {
            id: "new-landmark",
            name: "New landmark",
            address: "Osmeña Boulevard",
            latitude: 10.32,
            longitude: 123.89,
            source: "custom",
          },
        ]}
        {...callbacks}
      />,
    );

    expect(screen.getByText("To be added (1)")).toBeTruthy();
    expect(screen.getByText("New landmark")).toBeTruthy();
    expect(screen.getByText("Osmeña Boulevard")).toBeTruthy();
    expect(screen.getByText("To be removed (1)")).toBeTruthy();
    expect(screen.getByText("Old landmark")).toBeTruthy();
    expect(screen.getByText("Colon Street")).toBeTruthy();
    await screen.unmount();
  });
});
