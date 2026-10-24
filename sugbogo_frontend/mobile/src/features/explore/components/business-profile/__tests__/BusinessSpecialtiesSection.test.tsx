import { act, fireEvent, render } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import useBusinessVouch from "../../../hooks/useBusinessVouch";
import BusinessSpecialtiesSection from "../BusinessSpecialtiesSection";

jest.mock("../../../hooks/useBusinessVouch", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("../BusinessSpecialtiesPresentation", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({
      disabled,
      onVouch,
    }: {
      disabled: boolean;
      onVouch: (tagId: number) => void;
    }) => (
      <Pressable
        testID="vouch"
        disabled={disabled}
        onPress={() => onVouch(4)}
      />
    ),
  };
});

describe("optimistic vouch feedback", () => {
  const vouch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
    (useBusinessVouch as jest.Mock).mockReturnValue({
      vouch,
      pendingTagId: null,
    });
  });

  afterEach(() => onlineManager.setOnline(true));

  async function renderSection(isVouched = false) {
    return render(
      <BusinessSpecialtiesSection
        businessId={20}
        isOwnBusiness={false}
        specialtyTags={[
          {
            id: 4,
            name: "Coffee",
            color: "blue",
            icon: null,
            vouch_count: 2,
            is_vouched: isVouched,
          },
        ]}
      />,
    );
  }

  it.each([false, true])(
    "shows immediate feedback while the request is unresolved (vouched: %s)",
    async (isVouched) => {
      let resolveRequest!: () => void;
      vouch.mockReturnValue(new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }));
      const screen = await renderSection(isVouched);

      await fireEvent.press(screen.getByTestId("vouch"));

      expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
        type: "info",
        text1: isVouched ? "Vouch removed" : "Vouched for Coffee",
      }));
      await fireEvent.press(screen.getByTestId("vouch"));
      expect(vouch).toHaveBeenCalledTimes(1);

      await act(async () => resolveRequest());
      expect(Toast.show).toHaveBeenCalledTimes(1);
    },
  );

  it("replaces optimistic feedback with an error when the request fails", async () => {
    let rejectRequest!: (error: unknown) => void;
    vouch.mockReturnValue(new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    const screen = await renderSection();
    await fireEvent.press(screen.getByTestId("vouch"));

    await act(async () => {
      rejectRequest({ success: false, message: "Please try again" });
    });

    expect(Toast.show).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "error",
    }));
  });

  it("does not show optimistic feedback or submit while offline", async () => {
    onlineManager.setOnline(false);
    const screen = await renderSection();
    await fireEvent.press(screen.getByTestId("vouch"));

    expect(vouch).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
