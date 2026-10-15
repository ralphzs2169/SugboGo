import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { saveJourney } from "../../services/savedJourneys.service";
import { snapshot } from "../../utils/__tests__/savedJourney.fixture";
import SaveOfflineJourneyButton from "../SaveOfflineJourneyButton";

jest.mock("../../services/savedJourneys.service", () => ({
  saveJourney: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

describe("explicit offline save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
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
    const button = screen.getByRole("button", { name: "Save offline" });
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

  it("displays a persistent failure and permits retry", async () => {
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
    await fireEvent.press(screen.getByRole("button", { name: "Save offline" }));
    expect(screen.getByText("Device storage unavailable")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Save offline" }));
    expect(saveJourney).toHaveBeenCalledTimes(2);
    await screen.unmount();
  });
});
