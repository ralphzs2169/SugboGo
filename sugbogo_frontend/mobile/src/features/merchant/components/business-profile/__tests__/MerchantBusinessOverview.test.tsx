import React from "react";
import { render } from "@testing-library/react-native";

import type { MerchantBusinessProfileResponse } from "../../../types/merchantBusinessProfile.types";
import MerchantBusinessOverview from "../MerchantBusinessOverview";

const business: MerchantBusinessProfileResponse = {
  id: 7,
  business_name: "Sugbo Bistro",
  description: "Local Cebu food",
  contact_number: "+639171234567",
  business_email: "hello@sugbogogo.test",
  website: "https://example.com",
  status: "active",
  cover_photo_url: null,
  cover_photo_retry_after: null,
  cover_photo_update: { limit: 3, remaining: 2, resets_at: null },
  category: { id: 2, name: "Restaurants" },
  cluster: { id: 1, name: "Food and Dining" },
  specialty_tags: [{ id: 3, name: "Lechon", color: "blue", icon: "tag" }],
  location: {
    address: "Gorordo Avenue",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    latitude: 10.3157,
    longitude: 123.8854,
    landmarks: [{ id: 1, name: "Ayala Center", address: "Cebu Business Park" }],
  },
  operating_hours: [
    {
      day: "monday",
      is_open: false,
      is_24_hours: false,
      open_time: null,
      close_time: null,
    },
    {
      day: "tuesday",
      is_open: true,
      is_24_hours: true,
      open_time: null,
      close_time: null,
    },
    {
      day: "wednesday",
      is_open: true,
      is_24_hours: false,
      open_time: "22:00:00",
      close_time: "02:00:00",
    },
  ],
  photos: [
    {
      id: 1,
      category: "storefront",
      url: "https://example.com/storefront.jpg",
      file_name: "storefront.jpg",
    },
  ],
  verification: {
    representative_name: "Juan Dela Cruz",
    representative_role: "owner",
    documents: [
      {
        id: 1,
        document_type: "business_registration",
        file_name: "registration.pdf",
      },
    ],
  },
};

describe("MerchantBusinessOverview", () => {
  it("shows approved listing facts and original verification metadata", async () => {
    const screen = await render(<MerchantBusinessOverview business={business} />);

    expect(screen.getByText("Local Cebu food")).toBeTruthy();
    expect(screen.getByText("Restaurants")).toBeTruthy();
    expect(screen.getByText("Food and Dining")).toBeTruthy();
    expect(screen.getByText("Lechon")).toBeTruthy();
    expect(screen.getByText("Gorordo Avenue")).toBeTruthy();
    expect(screen.getByText("Ayala Center")).toBeTruthy();
    expect(screen.getByText("Closed")).toBeTruthy();
    expect(screen.getByText("Open 24 hours")).toBeTruthy();
    expect(screen.getByText(/next day/)).toBeTruthy();
    expect(screen.getByText("storefront.jpg")).toBeTruthy();
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("registration.pdf")).toBeTruthy();
    expect(screen.queryByText("2 cover photo updates remaining.")).toBeNull();
  });

  it("distinguishes missing hours from a closed day", async () => {
    const screen = await render(
      <MerchantBusinessOverview
        business={{ ...business, operating_hours: [], specialty_tags: [] }}
      />,
    );

    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.getByText("No active specialties")).toBeTruthy();
    expect(screen.queryByText("Closed")).toBeNull();
  });
});
