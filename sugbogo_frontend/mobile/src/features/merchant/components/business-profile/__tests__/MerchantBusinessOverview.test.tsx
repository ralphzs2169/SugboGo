import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { MerchantBusinessProfileResponse } from "../../../types/merchantBusinessProfile.types";
import MerchantBusinessOverview from "../MerchantBusinessOverview";

jest.mock(
  "@/features/merchant/components/registration/location/LocationPickerMap",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function MockMap() {
      return <Text>Location map preview</Text>;
    };
  },
);

const business: MerchantBusinessProfileResponse = {
  id: 7,
  business_name: "Sugbo Bistro",
  description: "Local Cebu food",
  contact_number: "+639171234567",
  business_email: "hello@example.com",
  website: "https://example.com",
  status: "active",
  cover_photo_url: null,
  cover_photo_retry_after: null,
  cover_photo_update: { limit: 3, remaining: 2, resets_at: null },
  category: { id: 2, name: "Restaurants" },
  cluster: { id: 1, name: "Food and Dining" },
  specialty_tags: [
    { id: 3, name: "Lechon", color: "blue", icon: "tag" },
    { id: 4, name: "Local Food", color: "green", icon: "chef_hat" },
    { id: 5, name: "Coffee", color: "yellow", icon: "coffee" },
  ],
  location: {
    address: "Gorordo Avenue",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    latitude: 10.3157,
    longitude: 123.8854,
    landmarks: [
      {
        id: 1,
        name: "Ayala Center",
        address: "Cebu Business Park",
        latitude: 10.318,
        longitude: 123.905,
        source: "google",
        place_id: "ayala-place",
      },
    ],
  },
  operating_hours: [
    {
      day: "monday",
      is_open: true,
      is_24_hours: false,
      open_time: "09:00:00",
      close_time: "18:00:00",
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
  it("shows live summaries without raw fields or reviewed-change actions", async () => {
    const screen = await render(
      <MerchantBusinessOverview business={business} clusterIcon="utensils" />,
    );

    expect(screen.getByText("Local Cebu food")).toBeTruthy();
    expect(screen.getByText("Restaurants")).toBeTruthy();
    expect(screen.getByText("Food and Dining")).toBeTruthy();
    expect(screen.queryByText("Restaurants · Food and Dining")).toBeNull();
    const clusterGlyph = String.fromCodePoint(
      Number(MaterialCommunityIcons.glyphMap["silverware-fork-knife"]),
    );
    expect(screen.getAllByText(clusterGlyph).length).toBeGreaterThan(0);
    expect(screen.getByText("Specialties")).toBeTruthy();
    expect(screen.getByText("Lechon")).toBeTruthy();
    expect(screen.getByText("Local Food")).toBeTruthy();
    expect(screen.getByText("Coffee")).toBeTruthy();
    const specialtyGlyph = String.fromCodePoint(
      Number(MaterialCommunityIcons.glyphMap["tag-outline"]),
    );
    expect(screen.getByText(specialtyGlyph)).toBeTruthy();
    expect(screen.queryByText(/vouches?/i)).toBeNull();
    expect(screen.getByText("Gorordo Avenue")).toBeTruthy();
    expect(screen.getByText("1 landmark")).toBeTruthy();
    expect(screen.getByText("Location map preview")).toBeTruthy();
    expect(screen.getByLabelText("Business photo 1")).toBeTruthy();
    expect(screen.queryByText("storefront.jpg")).toBeNull();
    expect(screen.queryByText("10.3157, 123.8854")).toBeNull();
    expect(screen.queryByText("Request classification change")).toBeNull();
    expect(screen.queryByLabelText("Edit classification")).toBeNull();
    expect(screen.queryByText("Request location change")).toBeNull();
    expect(screen.queryByText("Juan Dela Cruz")).toBeNull();
    expect(screen.getByText("More")).toBeTruthy();
  });

  it("expands hours and read-only verification details on demand", async () => {
    const screen = await render(
      <MerchantBusinessOverview business={business} />,
    );

    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.queryByText("monday")).toBeNull();
    await fireEvent.press(screen.getByText("View weekly schedule"));
    expect(screen.getByText("monday")).toBeTruthy();
    await fireEvent.press(screen.getByText("Business Verification"));
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("registration.pdf")).toBeTruthy();
  });

  it("keeps direct edits and pending details available while restricting suspended edits", async () => {
    const onEditInformation = jest.fn();
    const onEditOperatingHours = jest.fn();
    const onManagePhotos = jest.fn();
    const onPending = jest.fn();
    const screen = await render(
      <MerchantBusinessOverview
        business={business}
        onEditInformation={onEditInformation}
        onEditOperatingHours={onEditOperatingHours}
        onManagePhotos={onManagePhotos}
        pendingClassificationRequest={{ id: 4 } as never}
        onClassificationHistory={onPending}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Edit business information"));
    await fireEvent.press(screen.getByLabelText("Edit operating hours"));
    await fireEvent.press(screen.getByLabelText("Manage photos"));
    expect(screen.getByText("Pending review")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("View pending classification request"),
    );
    expect(onEditInformation).toHaveBeenCalledTimes(1);
    expect(onEditOperatingHours).toHaveBeenCalledTimes(1);
    expect(onManagePhotos).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledTimes(1);

    const suspended = await render(
      <MerchantBusinessOverview
        business={{ ...business, status: "suspended" }}
        onEditInformation={onEditInformation}
      />,
    );
    expect(suspended.queryByLabelText("Edit business information")).toBeNull();
  });

  it("keeps location pending contextual and the mode switch in More", async () => {
    const onPendingLocation = jest.fn();
    const onSwitchToExplorer = jest.fn();
    const screen = await render(
      <MerchantBusinessOverview
        business={business}
        pendingLocationRequest={{ id: 22 } as never}
        onLocationHistory={onPendingLocation}
        onSwitchToExplorer={onSwitchToExplorer}
      />,
    );

    expect(screen.getByText("Pending review")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("View pending location request"),
    );
    await fireEvent.press(screen.getByText("Switch to Explorer"));
    expect(onPendingLocation).toHaveBeenCalledTimes(1);
    expect(onSwitchToExplorer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Request location change")).toBeNull();
    expect(screen.queryByText("Change Requests")).toBeNull();
  });

  it("retains classification request-status loading feedback", async () => {
    const loading = await render(
      <MerchantBusinessOverview business={business} isCheckingClassification />,
    );
    expect(loading.getByText("Checking request status...")).toBeTruthy();
  });

  it("retains classification request-status retry feedback", async () => {
    const onRetryClassification = jest.fn();
    const failed = await render(
      <MerchantBusinessOverview
        business={business}
        hasClassificationError
        onRetryClassification={onRetryClassification}
      />,
    );
    await fireEvent.press(failed.getByText("Retry request status"));
    expect(onRetryClassification).toHaveBeenCalledTimes(1);
  });

  it("limits the photo preview to thumbnails without filenames", async () => {
    const photos = [1, 2, 3, 4].map((id) => ({
      id,
      category: "additional" as const,
      url: `https://example.com/${id}.jpg`,
      file_name: `upload-${id}.jpg`,
    }));
    const screen = await render(
      <MerchantBusinessOverview business={{ ...business, photos }} />,
    );

    expect(screen.getAllByLabelText(/Business photo/)).toHaveLength(3);
    expect(screen.getByText("4 business photos")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.queryByText("upload-1.jpg")).toBeNull();
  });
});
