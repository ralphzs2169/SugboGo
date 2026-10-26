import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Interests from "@/app/(setup)/interests";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useCompleteOnboardingInterests } from "@/features/profile/hooks/your-interests/useInterestMutations";
import useUserInterests from "@/features/profile/hooks/your-interests/useUserInterests";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import Toast from "react-native-toast-message";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  router: { replace: mockReplace },
}));
jest.mock("@/features/profile/hooks/your-interests/useUserInterests");
jest.mock("@/features/profile/hooks/your-interests/useInterestMutations");
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const tags = [
  { id: 14, name: "Local Coffee", color: "blue" },
  { id: 21, name: "Traditional Food", color: "red" },
  { id: 37, name: "Handmade Crafts", color: "purple" },
  { id: 52, name: "Outdoor Dining", color: "green" },
] as const;

describe("onboarding interests", () => {
  const mutateAsync = jest.fn().mockResolvedValue({});
  const refetch = jest.fn();

  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1, has_completed_interest_selection: false } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    (useCompleteOnboardingInterests as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    (useUserInterests as jest.Mock).mockReturnValue({
      data: {
        categories: [],
        specialty_tags: [],
        available_categories: [],
        available_specialty_tags: tags,
      },
      isLoading: false,
      error: null,
      refetch,
      userId: 1,
      generation: getAuthSessionGeneration(),
    });
  });

  it("tracks selections and enforces the optional three-tag limit", async () => {
    const screen = await render(<Interests />);
    const coffee = screen.getByLabelText("Local Coffee");

    expect(coffee.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(coffee);
    expect(
      screen.getByTestId("interest-selection-progress").props.children,
    ).toEqual([1, " / 3 selected"]);
    expect(
      screen.getByLabelText("Local Coffee").props.accessibilityState.selected,
    ).toBe(true);

    await fireEvent.press(screen.getByLabelText("Traditional Food"));
    await fireEvent.press(screen.getByLabelText("Handmade Crafts"));
    expect(
      screen.getByTestId("interest-selection-progress").props.children,
    ).toEqual([3, " / 3 selected"]);
    expect(
      screen.getByLabelText("Outdoor Dining").props.accessibilityState.disabled,
    ).toBe(true);

    await fireEvent.press(screen.getByLabelText("Local Coffee"));
    await fireEvent.press(screen.getByLabelText("Outdoor Dining"));
    expect(
      screen.getByLabelText("Outdoor Dining").props.accessibilityState.selected,
    ).toBe(true);
  });

  it("submits real IDs and allows zero-selection Skip", async () => {
    const screen = await render(<Interests />);
    await fireEvent.press(screen.getByLabelText("Local Coffee"));
    await fireEvent.press(screen.getByText("Start Exploring"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith([14]));

    await fireEvent.press(screen.getByLabelText("Skip interest selection"));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith([]));
    expect(useAuthStore.getState().user?.has_completed_interest_selection).toBe(
      true,
    );
  });

  it("does not restore the originating account or navigate after a stale setup save", async () => {
    let finish!: (value: unknown) => void;
    mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await render(<Interests />);
    await fireEvent.press(screen.getByLabelText("Local Coffee"));
    await fireEvent.press(screen.getByText("Start Exploring"));
    await act(async () => {
      beginAuthSession();
      useAuthStore.getState().setUser({ id: 2 } as User);
      finish({});
    });
    expect(useAuthStore.getState().user?.id).toBe(2);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it("keeps a persistent load error whose Retry refetches taxonomy", async () => {
    (useUserInterests as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Unavailable",
      },
      refetch,
    });
    const screen = await render(<Interests />);

    await fireEvent.press(
      screen.getByRole("button", { name: /Tap to retry/i }),
    );

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Local Coffee")).toBeNull();
  });
});
