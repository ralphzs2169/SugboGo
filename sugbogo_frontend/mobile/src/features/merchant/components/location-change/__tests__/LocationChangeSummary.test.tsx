import React from "react";
import { render } from "@testing-library/react-native";

import LocationChangeSummary from "../LocationChangeSummary";

const location = {
  latitude: 10.31,
  longitude: 123.88,
  address: "Osmeña Boulevard",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};

describe("Location change summary", () => {
  it("identifies a landmark-only request without implying the business moved", async () => {
    const screen = await render(
      <LocationChangeSummary
        previousLocation={location}
        requestedLocation={location}
        previousLandmarks={[]}
        requestedLandmarks={[
          {
            name: "Cebu landmark",
            address: "Nearby",
            latitude: 10.32,
            longitude: 123.89,
            source: "google",
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "Business location and address unchanged · Landmarks: 1 added",
      ),
    ).toBeTruthy();
    await screen.unmount();
  });
});
