import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import MerchantBusinessInformationEditScreen from "../MerchantBusinessInformationEditScreen";

jest.setTimeout(15000);

const mockProfile = jest.fn();
const mockUpdateInformation = jest.fn();
const mockSetOptions = jest.fn();
const mockConfirmModal = jest.fn((_props: unknown) => null);

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock(
  "../../../hooks/business-profile/useUpdateMerchantBusinessInformation",
  () => ({
    __esModule: true,
    default: () => ({
      updateInformation: mockUpdateInformation,
      isSaving: false,
    }),
  }),
);

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));

jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({
    HeaderBackButton: ({ onPress }: { onPress: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onPress} accessibilityLabel="Back">
          <Text>Back</Text>
        </Pressable>
      );
    },
  }),
);

jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockConfirmModal(props),
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
  afterEach(async () => {
    await cleanup();
  });

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

    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);

    await fireEvent.changeText(
      screen.getByDisplayValue(business.description),
      "Updated business description",
    );

    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(false);

    await fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateInformation).toHaveBeenCalledWith({
        description: "Updated business description",
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

  it("disables Save again when an edit is reverted", async () => {
    const screen = await render(<MerchantBusinessInformationEditScreen />);
    const saveButton = screen.getByRole("button", { name: "Save Changes" });

    await fireEvent.changeText(
      screen.getByDisplayValue(business.website),
      "https://updated.example.com",
    );
    expect(saveButton.props.accessibilityState.disabled).toBe(false);

    await fireEvent.changeText(
      screen.getByDisplayValue("https://updated.example.com"),
      business.website,
    );
    expect(saveButton.props.accessibilityState.disabled).toBe(true);
    expect(mockUpdateInformation).not.toHaveBeenCalled();
  });

  it("leaves without confirmation when no information has changed", async () => {
    const screen = await render(<MerchantBusinessInformationEditScreen />);

    fireEvent.press(screen.getByText("Cancel"));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(
      false,
    );
  });

  it("confirms discarding edits from Cancel and header Back", async () => {
    const screen = await render(<MerchantBusinessInformationEditScreen />);
    await fireEvent.changeText(
      screen.getByDisplayValue(business.description),
      "Updated business description",
    );

    await fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() =>
      expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(
        true,
      ),
    );
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onCancel();
    });

    const headerLeft = mockSetOptions.mock.lastCall?.[0].headerLeft;
    const header = await render(headerLeft());
    await fireEvent.press(header.getByLabelText("Back"));
    await waitFor(() =>
      expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(
        true,
      ),
    );
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockUpdateInformation).not.toHaveBeenCalled();
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

    await fireEvent.changeText(
      screen.getByDisplayValue(business.contact_number),
      "09170000000",
    );
    await fireEvent.press(screen.getByText("Save Changes"));

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

    await fireEvent.changeText(
      screen.getByDisplayValue(business.description),
      "Updated business description",
    );
    await fireEvent.press(screen.getByText("Save Changes"));
    await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockUpdateInformation).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveSave({});
    });
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });
});
