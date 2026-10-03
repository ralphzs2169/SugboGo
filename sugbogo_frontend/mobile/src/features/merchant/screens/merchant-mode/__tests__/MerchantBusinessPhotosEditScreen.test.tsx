import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { pickBusinessPhotos } from "../../../components/business-photos/PhotoPicker";
import MerchantBusinessPhotosEditScreen from "../MerchantBusinessPhotosEditScreen";

const mockProfile = jest.fn();
const mockSavePhotos = jest.fn();
let mockIsSaving = false;

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock(
  "../../../hooks/business-profile/useUpdateMerchantBusinessPhotos",
  () => ({
    __esModule: true,
    default: () => ({ savePhotos: mockSavePhotos, isSaving: mockIsSaving }),
  }),
);

jest.mock("../../../components/business-photos/PhotoPicker", () => ({
  pickBusinessPhotos: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const business = {
  id: 7,
  status: "active",
  photos: [
    {
      id: 1,
      category: "storefront",
      url: "https://example.com/storefront.jpg",
      file_name: "storefront.jpg",
    },
  ],
};

describe("MerchantBusinessPhotosEditScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSaving = false;
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockSavePhotos.mockResolvedValue([]);
    (pickBusinessPhotos as jest.Mock).mockResolvedValue([]);
  });

  it("shows existing photos and category counts", async () => {
    const screen = await render(<MerchantBusinessPhotosEditScreen />);

    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());
    expect(screen.getAllByText("0 / 5")).toHaveLength(3);
    expect(screen.getByLabelText("Preview photo")).toBeTruthy();
  });

  it("stops adding when a category reaches its maximum", async () => {
    mockProfile.mockReturnValue({
      business: {
        ...business,
        photos: [
          business.photos[0],
          {
            id: 2,
            category: "storefront",
            url: "https://example.com/second.jpg",
            file_name: "second.jpg",
          },
          {
            id: 3,
            category: "storefront",
            url: "https://example.com/third.jpg",
            file_name: "third.jpg",
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const screen = await render(<MerchantBusinessPhotosEditScreen />);

    await waitFor(() => expect(screen.getByText("3 / 3")).toBeTruthy());
    expect(screen.queryByLabelText("Add storefront photos")).toBeNull();
    expect(pickBusinessPhotos).not.toHaveBeenCalled();
  });

  it("stages a removal and allows a replacement before one save", async () => {
    const screen = await render(<MerchantBusinessPhotosEditScreen />);
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Remove photo"));
    });
    await waitFor(() => expect(screen.getByText("0 / 3")).toBeTruthy());
    expect(mockSavePhotos).not.toHaveBeenCalled();

    (pickBusinessPhotos as jest.Mock).mockResolvedValue([
      {
        uri: "file:///replacement.png",
        fileName: "replacement.png",
        mimeType: "image/png",
      },
    ]);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add storefront photos"));
    });
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());
    expect(screen.getAllByLabelText("Preview photo")).toHaveLength(1);

    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => expect(mockSavePhotos).toHaveBeenCalledTimes(1));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("requires a final storefront and keeps pending state after failed save", async () => {
    const screen = await render(<MerchantBusinessPhotosEditScreen />);
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Remove photo"));
    });
    await waitFor(() => expect(screen.getByText("0 / 3")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });

    await waitFor(() =>
      expect(
        screen.getByText("At least one storefront photo is required."),
      ).toBeTruthy(),
    );
    expect(mockSavePhotos).not.toHaveBeenCalled();
    expect(screen.getByText(/marked for removal/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText("Undo removal of storefront.jpg photo"),
      );
    });
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());
  });

  it("does not show an editing screen for suspended businesses", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantBusinessPhotosEditScreen />);

    expect(screen.getByText("Editing unavailable")).toBeTruthy();
    expect(screen.queryByText("Save Changes")).toBeNull();
  });

  it("keeps pending removals when saving fails", async () => {
    mockProfile.mockReturnValue({
      business: {
        ...business,
        photos: [
          ...business.photos,
          {
            id: 2,
            category: "interior",
            url: "https://example.com/interior.jpg",
            file_name: "interior.jpg",
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockSavePhotos.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Unable to save.",
      errors: { interior: ["Please review interior photos."] },
    });
    const screen = await render(<MerchantBusinessPhotosEditScreen />);
    await waitFor(() =>
      expect(screen.getAllByLabelText("Remove photo")).toHaveLength(2),
    );

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText("Remove photo")[1]);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });

    await waitFor(() => expect(mockSavePhotos).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Please review interior photos.")).toBeTruthy();
    expect(screen.getByText(/interior.jpg marked for removal/)).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("disables saving while a request is pending", async () => {
    const screen = await render(<MerchantBusinessPhotosEditScreen />);
    await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Remove photo"));
    });
    (pickBusinessPhotos as jest.Mock).mockResolvedValue([
      { uri: "file:///new.jpg", fileName: "new.jpg", mimeType: "image/jpeg" },
    ]);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add storefront photos"));
    });

    mockIsSaving = true;
    await screen.rerender(<MerchantBusinessPhotosEditScreen />);

    const saveButton = screen.getByLabelText("Save Changes");
    expect(saveButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(saveButton);
    expect(mockSavePhotos).not.toHaveBeenCalled();
  });
});
