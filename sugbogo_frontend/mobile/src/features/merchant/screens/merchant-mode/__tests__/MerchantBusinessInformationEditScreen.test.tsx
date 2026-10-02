import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import MerchantBusinessInformationEditScreen from "../MerchantBusinessInformationEditScreen";

jest.setTimeout(15000);

const mockProfile = jest.fn();
const mockUpdateInformation = jest.fn();

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock("../../../hooks/business-profile/useUpdateMerchantBusinessInformation", () => ({
  __esModule: true,
  default: () => ({
    updateInformation: mockUpdateInformation,
    isSaving: false,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

const business = {
  id: 7,
  status: "active",
  description: "Original business description",
  contact_number: "09171234567",
  business_email: "original@example.com",
  website: "https://example.com",
};

describe("MerchantBusinessInformationEditScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUpdateInformation.mockResolvedValue({
      description: business.description,
      contact_number: business.contact_number,
      business_email: business.business_email,
      website: business.website,
    });
  });

  it("does not render the form for a suspended business", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantBusinessInformationEditScreen />);

    expect(screen.getByText("Editing unavailable")).toBeTruthy();
    expect(screen.queryByText("Save Changes")).toBeNull();
  });

  it("prefills and submits the four current information fields", async () => {
    const screen = await render(<MerchantBusinessInformationEditScreen />);

    expect(screen.getByDisplayValue(business.description)).toBeTruthy();
    expect(screen.getByDisplayValue(business.contact_number)).toBeTruthy();
    expect(screen.getByDisplayValue(business.business_email)).toBeTruthy();
    expect(screen.getByDisplayValue(business.website)).toBeTruthy();

    fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateInformation).toHaveBeenCalledWith({
        description: business.description,
        contact_number: business.contact_number,
        business_email: business.business_email,
        website: business.website,
      });
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      );
    });
  });

  it("renders backend field errors on the corresponding input", async () => {
    mockUpdateInformation.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Enter a valid Philippine mobile number.",
      errors: {
        contact_number: ["Enter a valid Philippine mobile number."],
      },
    });
    const screen = await render(<MerchantBusinessInformationEditScreen />);

    fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid Philippine mobile number."),
      ).toBeTruthy();
    });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("prevents a duplicate save while the first request is pending", async () => {
    let resolveSave: (value: unknown) => void = () => {};
    mockUpdateInformation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const screen = await render(<MerchantBusinessInformationEditScreen />);

    fireEvent.press(screen.getByText("Save Changes"));
    fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateInformation).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveSave({});
    });
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

});
