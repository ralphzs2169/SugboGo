import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { saveJourney } from "../../services/savedJourneys.service";
import { snapshot } from "../../utils/__tests__/savedJourney.fixture";
import SaveOfflineJourneyButton from "../SaveOfflineJourneyButton";

jest.mock("../../services/savedJourneys.service", () => ({
  saveJourney: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

describe("explicit offline save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it.each([
    undefined,
    null,
    "",
    " \n ",
    "  Use the blue gate.\nWalk inside.  ",
  ])("saves normalized optional merchant context (%s)", async (directions) => {
    (saveJourney as jest.Mock).mockResolvedValue("21:8:2:4");
    const screen = await render(
      <SaveOfflineJourneyButton
        businessId={21}
        businessName={snapshot.business.name}
        accessDirections={directions}
        journey={snapshot.journey}
        origin={snapshot.origin}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save journey offline" }),
    );
    const saved = jest.mocked(saveJourney).mock.calls[0][0];
    if (directions?.trim()) {
      expect(saved.business.access_directions).toBe(directions.trim());
    } else {
      expect(saved.business).not.toHaveProperty("access_directions");
    }
    await screen.unmount();
  });

  it("saves only on press and prevents duplicate pending saves", async () => {
    let finish!: (value: string) => void;
    (saveJourney as jest.Mock).mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await render(
      <SaveOfflineJourneyButton
        businessId={21}
        businessName={snapshot.business.name}
        journey={snapshot.journey}
        origin={snapshot.origin}
      />,
    );
    expect(saveJourney).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Save journey offline" });
    const firstPress = fireEvent.press(button);
    await waitFor(() => expect(saveJourney).toHaveBeenCalledTimes(1));
    await fireEvent.press(button);
    expect(saveJourney).toHaveBeenCalledTimes(1);
    expect(saveJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        business: snapshot.business,
        origin: snapshot.origin,
        journey: snapshot.journey,
      }),
    );
    await act(async () => finish("21:8:2:4"));
    await firstPress;
    await screen.unmount();
  });

  it("reports a save failure and permits retry", async () => {
    (saveJourney as jest.Mock).mockRejectedValue(
      new Error("Device storage unavailable"),
    );
    const screen = await render(
      <SaveOfflineJourneyButton
        businessId={21}
        businessName={snapshot.business.name}
        journey={snapshot.journey}
        origin={snapshot.origin}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save journey offline" }),
    );
    expect(
      jest.requireMock("react-native-toast-message").show,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ text2: "Device storage unavailable" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save journey offline" }),
    );
    expect(saveJourney).toHaveBeenCalledTimes(2);
    await screen.unmount();
  });
});
