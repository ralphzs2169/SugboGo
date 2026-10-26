import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";

import { handleSystemError } from "@/shared/utils/apiErrors";

import { useUpdateUserInterests } from "../../hooks/your-interests/useInterestMutations";
import useUserInterests from "../../hooks/your-interests/useUserInterests";
import YourInterestsScreen from "../YourInterestsScreen";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";

jest.mock("../../hooks/your-interests/useUserInterests");
jest.mock("../../hooks/your-interests/useInterestMutations");
let mockRecommendationEntry = false;
const mockBeforeRemove = new Set<
  (event: { preventDefault: () => void }) => void
>();
const mockNavigation = {
  addListener: jest.fn(
    (
      _event: string,
      listener: (event: { preventDefault: () => void }) => void,
    ) => {
      mockBeforeRemove.add(listener);
      return () => mockBeforeRemove.delete(listener);
    },
  ),
};
jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => ({
    source: mockRecommendationEntry ? "recommendations" : undefined,
  }),
  useNavigation: () => mockNavigation,
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
    mockBeforeRemove.clear();
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    mockRecommendationEntry = false;
    (router.canGoBack as jest.Mock).mockReturnValue(true);
    (useUserInterests as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      isEnabled: true,
      error: null,
      refetch,
      userId: 1,
      generation: getAuthSessionGeneration(),
    });
    (useUpdateUserInterests as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    (handleSystemError as jest.Mock).mockReturnValue(false);
  });

  it("preserves dirty local choices during a normal same-session refetch", async () => {
    const screen = await render(<YourInterestsScreen />);
    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    (useUserInterests as jest.Mock).mockReturnValue({
      data: { ...data, categories: [...data.categories] },
      isLoading: false,
      isEnabled: true,
      error: null,
      refetch,
      userId: 1,
      generation: getAuthSessionGeneration(),
    });
    await screen.rerender(<YourInterestsScreen />);
    expect(
      screen.getByLabelText("Traditional Food").props.accessibilityState
        .selected,
    ).toBe(true);
    await screen.unmount();
  });

  it("keeps blocking recovery for an initial failure without current-session content", async () => {
    (useUserInterests as jest.Mock).mockReturnValue({
      data: undefined,
      error: { success: false, message: "Offline" },
      isLoading: false,
      isEnabled: true,
      refetch,
      userId: 1,
      generation: getAuthSessionGeneration(),
    });
    const screen = await render(<YourInterestsScreen />);
    expect(screen.getByText("Unable to load your interests")).toBeTruthy();
    expect(screen.queryByLabelText("Traditional Food")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "preserves dirty choices and navigation protection through refresh failure and retry (cache removed: %s)",
    async (cacheRemoved) => {
      let finishRetry!: () => void;
      refetch.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishRetry = resolve;
        }),
      );
      const screen = await render(<YourInterestsScreen />);
      await fireEvent.press(screen.getByLabelText("Traditional Food"));
      const query = {
        data: cacheRemoved ? undefined : data,
        error: { success: false, message: "Refresh failed" },
        isLoading: false,
        isEnabled: true,
        refetch,
        userId: 1,
        generation: getAuthSessionGeneration(),
      };
      (useUserInterests as jest.Mock).mockReturnValue(query);
      await screen.rerender(<YourInterestsScreen />);
      expect(screen.getByText("Unable to refresh your interests")).toBeTruthy();
      expect(
        screen.getByLabelText("Traditional Food").props.accessibilityState
          .selected,
      ).toBe(true);
      expect(screen.queryByText("Go back")).toBeNull();

      const preventDefault = jest.fn();
      await act(async () => {
        mockBeforeRemove.forEach((listener) => listener({ preventDefault }));
      });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Discard changes?")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));

      await fireEvent.press(
        screen.getByRole("button", {
          name: "Unable to refresh your interests. Tap to retry.",
        }),
      );
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Refreshing your interests")).toBeTruthy();
      expect(
        screen.getByLabelText("Traditional Food").props.accessibilityState
          .selected,
      ).toBe(true);
      await fireEvent.press(screen.getByLabelText("Handmade Crafts"));

      (useUserInterests as jest.Mock).mockReturnValue({
        ...query,
        data: { ...data, specialty_tags: [] },
        error: null,
      });
      await act(async () => {
        finishRetry();
      });
      await screen.rerender(<YourInterestsScreen />);
      expect(screen.queryByText("Unable to refresh your interests")).toBeNull();
      expect(
        screen.getByLabelText("Traditional Food").props.accessibilityState
          .selected,
      ).toBe(true);
      expect(
        screen.getByLabelText("Handmade Crafts").props.accessibilityState
          .selected,
      ).toBe(true);
      expect(
        screen.getByRole("button", { name: "Save Changes" }).props
          .accessibilityState.disabled,
      ).toBe(false);
    },
  );

  it.each([1, 2])(
    "never retains the previous session's editor when owner %s has an initial error",
    async (ownerId) => {
      const screen = await render(<YourInterestsScreen />);
      await fireEvent.press(screen.getByLabelText("Traditional Food"));
      await act(async () => {
        beginAuthSession();
        useAuthStore.getState().setUser({ id: ownerId } as User);
      });
      (useUserInterests as jest.Mock).mockReturnValue({
        data: undefined,
        error: { success: false, message: "Offline" },
        isLoading: false,
        isEnabled: true,
        refetch,
        userId: ownerId,
        generation: getAuthSessionGeneration(),
      });
      await screen.rerender(<YourInterestsScreen />);
      expect(screen.getByText("Unable to load your interests")).toBeTruthy();
      expect(screen.queryByLabelText("Traditional Food")).toBeNull();
    },
  );

  it.each([1, 2])(
    "initializes fresh choices for a replacement login as owner %s",
    async (nextOwner) => {
      const screen = await render(<YourInterestsScreen />);
      await fireEvent.press(screen.getByLabelText("Handmade Crafts"));
      await act(async () => {
        beginAuthSession();
        useAuthStore.getState().setUser({ id: nextOwner } as User);
      });
      (useUserInterests as jest.Mock).mockReturnValue({
        data: {
          ...data,
          categories: [],
          specialty_tags: [data.available_specialty_tags[1]],
        },
        isLoading: false,
        isEnabled: true,
        error: null,
        refetch,
        userId: nextOwner,
        generation: getAuthSessionGeneration(),
      });
      await screen.rerender(<YourInterestsScreen />);
      expect(
        screen.getByLabelText("Cafe").props.accessibilityState.selected,
      ).toBe(false);
      expect(
        screen.getByLabelText("Local Coffee").props.accessibilityState.selected,
      ).toBe(false);
      expect(
        screen.getByLabelText("Handmade Crafts").props.accessibilityState
          .selected,
      ).toBe(false);
      expect(
        screen.getByLabelText("Traditional Food").props.accessibilityState
          .selected,
      ).toBe(true);
      await screen.unmount();
    },
  );

  it("does not navigate or show success when an old save finishes after account replacement", async () => {
    let finish!: (value: unknown) => void;
    mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await render(<YourInterestsScreen />);
    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    await fireEvent.press(screen.getByRole("button", { name: "Save Changes" }));
    await act(async () => {
      beginAuthSession();
      useAuthStore.getState().setUser({ id: 2 } as User);
      finish(data);
    });
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await screen.unmount();
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
