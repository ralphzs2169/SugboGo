import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { handleSystemError } from "@/shared/utils/apiErrors";

import { useUpdateUserInterests } from "../../hooks/useInterestMutations";
import useUserInterests from "../../hooks/useUserInterests";
import YourInterestsScreen from "../YourInterestsScreen";

jest.mock("../../hooks/useUserInterests");
jest.mock("../../hooks/useInterestMutations");
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const data = {
  categories: [
    { id: 8, name: "Cafe", cluster: { id: 1, name: "Culinary" } },
  ],
  specialty_tags: [
    { id: 14, name: "Local Coffee", color: "blue" },
  ],
  available_categories: [
    { id: 8, name: "Cafe", cluster: { id: 1, name: "Culinary" } },
    { id: 12, name: "Art Shops", cluster: { id: 2, name: "Creative" } },
  ],
  available_specialty_tags: [
    { id: 14, name: "Local Coffee", color: "blue" },
    { id: 21, name: "Traditional Food", color: "red" },
    { id: 37, name: "Handmade Crafts", color: "purple" },
    { id: 52, name: "Outdoor Dining", color: "green" },
  ],
};

describe("YourInterestsScreen", () => {
  const mutateAsync = jest.fn().mockResolvedValue(data);
  const refetch = jest.fn();

  beforeEach(() => {
    (useUserInterests as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      error: null,
      refetch,
    });
    (useUpdateUserInterests as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    (handleSystemError as jest.Mock).mockReturnValue(false);
  });

  it("groups authoritative categories and initializes onboarding selections", async () => {
    const screen = await render(<YourInterestsScreen />);

    expect(screen.getByText("Culinary")).toBeTruthy();
    expect(screen.getByText("Creative")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText("Cafe").props.accessibilityState.selected).toBe(
        true,
      );
      expect(
        screen.getByLabelText("Local Coffee").props.accessibilityState.selected,
      ).toBe(true);
    });
    expect(screen.queryByLabelText("Culinary")).toBeNull();
  });

  it("edits an unlimited local draft and saves authoritative IDs once", async () => {
    const screen = await render(<YourInterestsScreen />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Local Coffee").props.accessibilityState.selected,
      ).toBe(true);
    });

    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    await fireEvent.press(screen.getByLabelText("Handmade Crafts"));
    await fireEvent.press(screen.getByLabelText("Outdoor Dining"));
    expect(mutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Save Interests"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        category_ids: [8],
        specialty_tag_ids: [14, 21, 37, 52],
      });
    });
  });

  it("preserves the draft and avoids duplicate Toast after handled failure", async () => {
    const failure = {
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    };
    mutateAsync.mockRejectedValueOnce(failure);
    (handleSystemError as jest.Mock).mockReturnValue(true);
    const screen = await render(<YourInterestsScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText("Traditional Food")).toBeTruthy();
    });
    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    await fireEvent.press(screen.getByText("Save Interests"));

    await waitFor(() => expect(handleSystemError).toHaveBeenCalledWith(failure));

    expect(
      screen.getByLabelText("Traditional Food").props.accessibilityState.selected,
    ).toBe(true);
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
