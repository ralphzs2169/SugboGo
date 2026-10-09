import React from "react";
import {
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import MerchantProfileHeader from "../MerchantProfileHeader";

const mockPresent = jest.fn();
const mockPickFromGallery = jest.fn();

jest.mock("@/features/profile/hooks/useImagePicker", () => ({
  useImagePicker: () => ({
    pickFromGallery: mockPickFromGallery,
    takePhoto: jest.fn(),
  }),
}));

jest.mock("../MerchantCoverPhotoBottomSheet", () => {
  const { Pressable, Text } = jest.requireActual("react-native");

  return function MockCoverPhotoSheet({ sheetRef, onChoosePhoto }: any) {
    sheetRef.current = { present: mockPresent };

    return (
      <Pressable onPress={onChoosePhoto}>
        <Text>Choose photo</Text>
      </Pressable>
    );
  };
});

jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View } = jest.requireActual("react-native");

  return function MockConfirmModal({ visible, message }: any) {
    return visible ? <View>{message}</View> : null;
  };
});

jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

async function renderHeader(remaining: number) {
  const allowance = {
    limit: 3,
    remaining,
    resets_at: "2026-10-03T08:00:00Z",
  };
  const onCheckCoverAllowance = jest.fn(async () => allowance);

  const screen = await render(
    <MerchantProfileHeader
      businessName="Sugbo Bistro"
      classification="Restaurant · Culinary"
      clusterIcon="utensils"
      status="active"
      coverPhotoUrl={null}
      coverPhotoUpdate={allowance}
      onCheckCoverAllowance={onCheckCoverAllowance}
      onEditCover={jest.fn()}
    />,
  );

  return { ...screen, onCheckCoverAllowance };
}

describe("MerchantProfileHeader cover allowance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPickFromGallery.mockResolvedValue("file:///selected.jpg");
  });

  it("shows business identity once with its classification and status", async () => {
    const screen = await renderHeader(2);

    expect(screen.getAllByText("Sugbo Bistro")).toHaveLength(1);
    expect(screen.getByText("Restaurant · Culinary")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    const hero = screen.getByTestId("merchant-cover-hero");
    expect(within(hero).getByText("Sugbo Bistro")).toBeTruthy();
    expect(within(hero).getByText("Restaurant · Culinary")).toBeTruthy();
    const clusterGlyph = String.fromCodePoint(
      Number(MaterialCommunityIcons.glyphMap["silverware-fork-knife"]),
    );
    expect(within(hero).getByText(clusterGlyph)).toBeTruthy();
    expect(screen.queryByText("Name change pending")).toBeNull();
  });

  it("keeps pending review navigation out of the hero", async () => {
    const allowance = { limit: 3, remaining: 2, resets_at: null };
    const screen = await render(
      <MerchantProfileHeader
        businessName="Sugbo Bistro"
        classification="Restaurant · Culinary"
        status="active"
        coverPhotoUrl={null}
        coverPhotoUpdate={allowance}
        onCheckCoverAllowance={jest.fn(async () => allowance)}
        onEditCover={jest.fn()}
      />,
    );

    expect(screen.queryByText("Name change pending")).toBeNull();
    expect(
      screen.queryByLabelText("View pending business name request"),
    ).toBeNull();
  });

  it("blocks the picker and shows the rolling reset when exhausted", async () => {
    const screen = await renderHeader(0);

    fireEvent.press(screen.getByText("Edit Cover"));

    await waitFor(() => {
      expect(screen.onCheckCoverAllowance).toHaveBeenCalledTimes(1);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text1: "Cover photo update limit reached",
          text2: expect.stringContaining("again at"),
        }),
      );
    });

    expect(mockPresent).not.toHaveBeenCalled();
    expect(mockPickFromGallery).not.toHaveBeenCalled();
  });

  it.each([
    [2, "2 cover photo updates remaining."],
    [1, "1 cover photo update remaining."],
  ])("shows %i remaining only in confirmation", async (remaining, message) => {
    const screen = await renderHeader(remaining);

    expect(screen.queryByText(message)).toBeNull();
    fireEvent.press(screen.getByText("Edit Cover"));

    await waitFor(() => expect(mockPresent).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByText("Choose photo"));

    await waitFor(() => {
      expect(mockPickFromGallery).toHaveBeenCalledTimes(1);
      expect(screen.getByText(message)).toBeTruthy();
    });
  });
});
