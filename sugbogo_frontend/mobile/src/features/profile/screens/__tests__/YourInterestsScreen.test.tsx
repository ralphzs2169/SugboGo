import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";

import { handleSystemError } from "@/shared/utils/apiErrors";

import { useUpdateUserInterests } from "../../hooks/your-interests/useInterestMutations";
import useUserInterests from "../../hooks/your-interests/useUserInterests";
import YourInterestsScreen from "../YourInterestsScreen";

jest.mock("../../hooks/your-interests/useUserInterests");
jest.mock("../../hooks/your-interests/useInterestMutations");
let mockRecommendationEntry = false;
jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => ({
    source: mockRecommendationEntry ? "recommendations" : undefined,
  }),
}));
jest.mock("../../hooks/useUnsavedChanges", () => ({
  useUnsavedChangesGuard: () => ({
    showConfirm: false,
    confirmLeave: jest.fn(),
    cancelLeave: jest.fn(),
    navigateWithoutConfirmation: (navigate: () => void) => navigate(),
  }),
}));
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const data = {
  categories: [{ id: 8, name: "Cafe", cluster: { id: 1, name: "Culinary" } }],
  specialty_tags: [{ id: 14, name: "Local Coffee", color: "blue" }],
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
    mockRecommendationEntry = false;
    (router.canGoBack as jest.Mock).mockReturnValue(true);
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

  it("explains selections and activity as inputs to For You", async () => {
    const screen = await render(<YourInterestsScreen />);

    expect(
      screen.getByText(/Choose categories and specialties that interest you/),
    ).toBeTruthy();
    expect(
      screen.getByText(/personalize For You alongside your activity/),
    ).toBeTruthy();
    expect(screen.getByText(/You can change them anytime/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("How recommendations work"));

    expect(screen.getByText(/selected interests and activity/)).toBeTruthy();
    expect(
      screen.getByText(/less-discovered places may be shown earlier/),
    ).toBeTruthy();
    expect(screen.getByText(/one input to your recommendations/)).toBeTruthy();
    expect(screen.getByText("Places you explore")).toBeTruthy();
    expect(screen.getByText("Places you save")).toBeTruthy();
    expect(screen.getByText("Specialties you vouch for")).toBeTruthy();
    expect(screen.queryByText(/Based on Your Interests/)).toBeNull();
  });

  it("groups authoritative categories and initializes onboarding selections", async () => {
    const screen = await render(<YourInterestsScreen />);

    expect(screen.getByText("Culinary")).toBeTruthy();
    expect(screen.getByText("Creative")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByLabelText("Cafe").props.accessibilityState.selected,
      ).toBe(true);
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

    await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        category_ids: [8],
        specialty_tag_ids: [14, 21, 37, 52],
      });
    });
    expect(router.replace).toHaveBeenCalledWith("/profile");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("returns to the existing homepage after saving from the recommendation CTA", async () => {
    mockRecommendationEntry = true;
    const screen = await render(<YourInterestsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Traditional Food")).toBeTruthy();
    });
    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledWith({
      category_ids: [8],
      specialty_tag_ids: [14, 21],
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
    await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(handleSystemError).toHaveBeenCalledWith(failure),
    );

    expect(
      screen.getByLabelText("Traditional Food").props.accessibilityState
        .selected,
    ).toBe(true);
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
