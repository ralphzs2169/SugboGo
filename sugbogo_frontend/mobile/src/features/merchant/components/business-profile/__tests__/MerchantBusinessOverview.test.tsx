import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import type { MerchantBusinessProfileResponse } from "../../../types/merchantBusinessProfile.types";
import MerchantBusinessDetails from "../MerchantBusinessDetails";

jest.mock(
  "@/features/merchant/components/registration/location/LocationPickerMap",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function MockMap() {
      return <Text>Location map preview</Text>;
    };
  },
);

jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function MockPhotoViewer({
    visible,
    initialIndex,
    onClose,
  }: {
    visible: boolean;
    initialIndex: number;
    onClose: () => void;
  }) {
    return visible ? (
      <Pressable onPress={onClose}>
        <Text>Photo viewer {initialIndex + 1}</Text>
      </Pressable>
    ) : null;
  };
});

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
        has_file: true,
      },
    ],
  },
};

describe("MerchantBusinessDetails", () => {
  it("opens the approved map without making the preview interactive", async () => {
    const onViewMap = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails business={business} onViewMap={onViewMap} />,
    );

    await fireEvent.press(
      screen.getByLabelText("View approved business location on map"),
    );
    expect(onViewMap).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Location map preview")).toBeTruthy();
  });

  it("opens available verification documents and shows preparation state", async () => {
    const onViewDocument = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails
        business={business}
        onViewDocument={onViewDocument}
      />,
    );

    await fireEvent.press(
      screen.getByLabelText("View business verification details"),
    );
    await fireEvent.press(
      screen.getByLabelText("Open Business Registration: registration.pdf"),
    );
    expect(onViewDocument).toHaveBeenCalledWith(1);

    const loading = await render(
      <MerchantBusinessDetails
        business={business}
        onViewDocument={onViewDocument}
        openingDocumentId={1}
      />,
    );
    await fireEvent.press(
      loading.getByLabelText("View business verification details"),
    );
    expect(
      loading.getByLabelText("Open Business Registration: registration.pdf")
        .props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  });

  it("keeps documents without an accessible file noninteractive", async () => {
    const onViewDocument = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails
        business={{
          ...business,
          verification: {
            ...business.verification!,
            documents: [
              { ...business.verification!.documents[0], has_file: false },
            ],
          },
        }}
        onViewDocument={onViewDocument}
      />,
    );

    await fireEvent.press(
      screen.getByLabelText("View business verification details"),
    );
    const row = screen.getByLabelText(
      "Business Registration: file unavailable",
    );
    expect(row.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(row);
    expect(onViewDocument).not.toHaveBeenCalled();
  });
  it("shows live summaries without raw fields or reviewed-change actions", async () => {
    const screen = await render(
      <MerchantBusinessDetails business={business} />,
    );

    expect(screen.queryByText("Classification")).toBeNull();
    expect(screen.getByText("Business details")).toBeTruthy();
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
      <MerchantBusinessDetails business={business} />,
    );

    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.queryByText("monday")).toBeNull();
    await fireEvent.press(screen.getByText("View weekly schedule"));
    expect(screen.getByText("monday")).toBeTruthy();
    await fireEvent.press(screen.getByText("Business Verification"));
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("registration.pdf")).toBeTruthy();
  });

  it("shows 24-hour opening once in the collapsed hours summary", async () => {
    const today = new Date()
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
    const screen = await render(
      <MerchantBusinessDetails
        business={{
          ...business,
          operating_hours: [
            {
              day: today,
              is_open: true,
              is_24_hours: true,
              open_time: null,
              close_time: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Open 24 hours")).toHaveLength(1);
    expect(screen.queryByText("Today")).toBeNull();
    await fireEvent.press(screen.getByText("View weekly schedule"));
    expect(screen.getAllByText("Open 24 hours")).toHaveLength(2);
  });

  it("keeps contact details available without expanding them by default", async () => {
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const screen = await render(
      <MerchantBusinessDetails business={business} />,
    );

    expect(screen.queryByText("hello@example.com")).toBeNull();
    await fireEvent.press(screen.getByText("Contact details"));
    expect(screen.getByText("+639171234567")).toBeTruthy();
    expect(screen.getByText("hello@example.com")).toBeTruthy();
    expect(screen.getByText("https://example.com")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Open phone: +639171234567"));
    expect(openUrl).toHaveBeenCalledWith("tel:+639171234567");
    await fireEvent.press(
      screen.getByLabelText("Open email: hello@example.com"),
    );
    expect(openUrl).toHaveBeenCalledWith("mailto:hello@example.com");
    await fireEvent.press(
      screen.getByLabelText("Open website: https://example.com"),
    );
    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    openUrl.mockRestore();
  });

  it("keeps direct edits available while restricting suspended edits", async () => {
    const onEditOperatingHours = jest.fn();
    const onManagePhotos = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails
        business={business}
        onEditOperatingHours={onEditOperatingHours}
        onManagePhotos={onManagePhotos}
      />,
    );

    await fireEvent.press(screen.getByLabelText("Edit operating hours"));
    await fireEvent.press(screen.getByLabelText("Manage photos"));
    expect(onEditOperatingHours).toHaveBeenCalledTimes(1);
    expect(onManagePhotos).toHaveBeenCalledTimes(1);

    const suspended = await render(
      <MerchantBusinessDetails
        business={{ ...business, status: "suspended" }}
        onEditOperatingHours={onEditOperatingHours}
      />,
    );
    expect(suspended.queryByLabelText("Edit operating hours")).toBeNull();
  });

  it("keeps location free of pending controls and the mode switch in More", async () => {
    const onSwitchToExplorer = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails
        business={business}
        onSwitchToExplorer={onSwitchToExplorer}
      />,
    );

    expect(screen.queryByText("Pending review")).toBeNull();
    await fireEvent.press(screen.getByText("Switch to Explorer"));
    expect(onSwitchToExplorer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Request location change")).toBeNull();
    expect(screen.queryByText("Change Requests")).toBeNull();
  });

  it("shows switching feedback and disables the Explorer mode row", async () => {
    const onSwitchToExplorer = jest.fn();
    const screen = await render(
      <MerchantBusinessDetails
        business={business}
        onSwitchToExplorer={onSwitchToExplorer}
        isSwitchingToExplorer
      />,
    );

    expect(screen.getByText("Switching to Explorer...")).toBeTruthy();
    expect(
      screen.getByTestId("merchant-switch-loading-indicator"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("merchant-switch-to-explorer").props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: true });
    await fireEvent.press(screen.getByTestId("merchant-switch-to-explorer"));
    expect(onSwitchToExplorer).not.toHaveBeenCalled();
  });

  it("limits the photo preview to thumbnails without filenames", async () => {
    const photos = [1, 2, 3, 4].map((id) => ({
      id,
      category: "additional" as const,
      url: `https://example.com/${id}.jpg`,
      file_name: `upload-${id}.jpg`,
    }));
    const screen = await render(
      <MerchantBusinessDetails business={{ ...business, photos }} />,
    );

    expect(screen.getAllByLabelText(/Business photo/)).toHaveLength(3);
    expect(screen.getByText("4 business photos")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.queryByText("upload-1.jpg")).toBeNull();
    await fireEvent.press(screen.getByLabelText("View business photo 2"));
    expect(screen.getByText("Photo viewer 2")).toBeTruthy();
    await fireEvent.press(screen.getByText("Photo viewer 2"));
    expect(screen.queryByText("Photo viewer 2")).toBeNull();
  });
});
