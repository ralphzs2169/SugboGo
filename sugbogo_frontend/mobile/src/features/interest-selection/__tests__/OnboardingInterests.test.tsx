import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Interests from "@/app/(setup)/interests";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useCompleteOnboardingInterests } from "@/features/profile/hooks/your-interests/useInterestMutations";
import useUserInterests from "@/features/interests/hooks/useUserInterests";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  router: { replace: jest.fn() },
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));
jest.mock("@/features/interests/hooks/useUserInterests");
jest.mock("@/features/interests/hooks/useInterestMutations");
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const tags = [
  { id: 14, name: "Local Coffee", color: "blue" },
  { id: 21, name: "Traditional Food", color: "red" },
  { id: 37, name: "Handmade Crafts", color: "purple" },
  { id: 52, name: "Outdoor Dining", color: "green" },
] as const;

describe("onboarding interests", () => {
  const mutateAsync = jest.fn().mockResolvedValue({});
  const setUser = jest.fn();
  const refetch = jest.fn();

  beforeEach(() => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      return selector({
        user: {
          id: 1,
          has_completed_interest_selection: false,
        },
        setUser,
      });
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
    });
  });

  it("uses authoritative colors and enforces the optional three-tag limit", async () => {
    const screen = await render(<Interests />);
    const coffee = screen.getByLabelText("Local Coffee");

    expect(coffee.props.className).toContain("bg-white");
    await fireEvent.press(coffee);
    expect(
      screen.getByTestId("interest-selection-progress").props.children,
    ).toEqual([1, " / 3 selected"]);
    expect(screen.getByLabelText("Local Coffee").props.className).toContain(
      "bg-blue-500",
    );

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
    expect(setUser).toHaveBeenCalled();
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

    await fireEvent.press(screen.getByText("Retry"));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Local Coffee")).toBeNull();
  });
});
