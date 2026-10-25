import { act, fireEvent, render } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import useSavedJourneys from "../../hooks/useSavedJourneys";
import { deleteSavedJourney } from "../../services/savedJourneys.service";
import { snapshot } from "../../utils/__tests__/savedJourney.fixture";
import OfflineRoutesScreen from "../OfflineRoutesScreen";

jest.mock("../../hooks/useSavedJourneys");
jest.mock("../../services/savedJourneys.service", () => ({
  deleteSavedJourney: jest.fn(),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: () => false,
  },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const MockConfirmModal = ({
    visible,
    onConfirm,
  }: {
    visible: boolean;
    onConfirm: () => void;
  }) =>
    visible ? (
      <Pressable onPress={onConfirm}>
        <Text>Confirm removal</Text>
      </Pressable>
    ) : null;
  return MockConfirmModal;
});

describe("saved guidance reader", () => {
  const reload = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    (useSavedJourneys as jest.Mock).mockReturnValue({
      ownerId: 7,
      items: [{ key: "21:8:2:4", snapshot }],
      isLoading: false,
      error: null,
      reload,
    });
    (deleteSavedJourney as jest.Mock).mockResolvedValue(undefined);
  });

  it("shows saved merchant directions separately with existing freshness context", async () => {
    const directions = "Use the blue gate.\nWalk behind the chapel.";
    (useSavedJourneys as jest.Mock).mockReturnValue({
      ownerId: 7,
      items: [
        {
          key: "21:8:2:4",
          snapshot: {
            ...snapshot,
            business: { ...snapshot.business, access_directions: directions },
          },
        },
      ],
      isLoading: false,
      error: null,
      reload,
    });
    const screen = await render(<OfflineRoutesScreen journeyKey="21:8:2:4" />);
    expect(screen.getByText(directions)).toBeTruthy();
    expect(screen.getByText("Merchant-provided directions")).toBeTruthy();
    expect(screen.getByText("How to reach us")).toBeTruthy();
    expect(screen.getByText(/merchant directions.*online/)).toBeTruthy();
  });

  it.each([undefined, "", "  \n "])(
    "hides absent or blank saved merchant context (%s)",
    async (directions) => {
      (useSavedJourneys as jest.Mock).mockReturnValue({
        ownerId: 7,
        items: [
          {
            key: "21:8:2:4",
            snapshot: {
              ...snapshot,
              business: { ...snapshot.business, access_directions: directions },
            },
          },
        ],
        isLoading: false,
        error: null,
        reload,
      });
      const screen = await render(
        <OfflineRoutesScreen journeyKey="21:8:2:4" />,
      );
      expect(screen.queryByText("Merchant-provided directions")).toBeNull();
    },
  );

  it("shows saved stops and origin without authenticating the user", async () => {
    const screen = await render(<OfflineRoutesScreen journeyKey="21:8:2:4" />);
    expect(screen.getByText("Board at Board here")).toBeTruthy();
    expect(screen.getByText("Get off at Get off here")).toBeTruthy();
    expect(screen.getByText("Saved starting point")).toBeTruthy();
    expect(screen.getByText("Saved start")).toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    screen.unmount();
  });

  it("shows the empty saved-journey list without requiring a saved journey", async () => {
    (useSavedJourneys as jest.Mock).mockReturnValue({
      ownerId: 7,
      items: [],
      isLoading: false,
      error: null,
      reload,
    });
    const screen = await render(<OfflineRoutesScreen />);
    expect(screen.getByText("No saved journeys")).toBeTruthy();
  });

  it("requires confirmation before deleting a corrupt entry", async () => {
    (useSavedJourneys as jest.Mock).mockReturnValue({
      ownerId: 7,
      items: [{ key: "bad", snapshot: null }],
      isLoading: false,
      error: null,
      reload,
    });
    const screen = await render(<OfflineRoutesScreen journeyKey="bad" />);
    await act(async () =>
      fireEvent.press(
        screen.getByRole("button", { name: "Remove saved journey" }),
      ),
    );
    expect(deleteSavedJourney).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText("Confirm removal")));
    expect(deleteSavedJourney).toHaveBeenCalledWith(7, "bad");
    expect(reload).toHaveBeenCalled();
    screen.unmount();
  });

  it("offers local retry on storage failure instead of showing an empty list", async () => {
    (useSavedJourneys as jest.Mock).mockReturnValue({
      ownerId: 7,
      items: [],
      isLoading: false,
      error: new Error("Device unavailable"),
      reload,
    });
    const screen = await render(<OfflineRoutesScreen />);
    await act(async () => fireEvent.press(screen.getByText("Retry")));
    expect(reload).toHaveBeenCalled();
    expect(screen.queryByText(/No saved journeys yet/)).toBeNull();
    screen.unmount();
  });
});
