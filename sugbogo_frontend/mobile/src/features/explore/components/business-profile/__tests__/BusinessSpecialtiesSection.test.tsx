import { act, fireEvent, render } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import useBusinessVouch from "../../../hooks/useBusinessVouch";
import BusinessSpecialtiesSection from "../BusinessSpecialtiesSection";

let mockVouchAction: (tagId: number, onAccepted?: () => void) => Promise<void>;

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
      onVouch: (tagId: number, onAccepted?: () => void) => Promise<void>;
    }) => {
      mockVouchAction = onVouch;
      return (
        <Pressable
          testID="vouch"
          disabled={disabled}
          onPress={() => {
            void onVouch(4);
          }}
        />
      );
    },
  };
});

describe("optimistic vouch feedback", () => {
  const vouch = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
    (useBusinessVouch as jest.Mock).mockReturnValue({ vouch });
  });
  afterEach(() => onlineManager.setOnline(true));
  async function renderSection(isOwnBusiness = false) {
    return render(
      <BusinessSpecialtiesSection
        businessId={20}
        isOwnBusiness={isOwnBusiness}
        specialtyTags={[
          {
            id: 4,
            name: "Coffee",
            color: "blue",
            icon: null,
            vouch_count: 2,
            is_vouched: false,
          },
        ]}
      />,
    );
  }

  it("accepts further taps while saving and shows no success toast before or after settlement", async () => {
    let finish!: () => void;
    const response = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vouch.mockReturnValue(response);
    const screen = await renderSection();
    await fireEvent.press(screen.getByTestId("vouch"));
    await fireEvent.press(screen.getByTestId("vouch"));
    expect(vouch).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTestId("vouch").props.accessibilityState?.disabled,
    ).not.toBe(true);
    expect(Toast.show).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("delegates the immediate celebration callback to the hook that owns latest intent", async () => {
    vouch.mockImplementation((_variables, onAccepted) => {
      onAccepted?.();
      return Promise.resolve();
    });
    await renderSection();
    const celebrate = jest.fn();
    await act(async () => {
      await mockVouchAction(4, celebrate);
    });
    expect(vouch).toHaveBeenCalledWith(
      { tagId: 4, isVouched: false },
      celebrate,
    );
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("shows one error and no success toast for a failed drain", async () => {
    vouch.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Rejected",
    });
    await renderSection();
    await act(async () => {
      await mockVouchAction(4);
    });
    expect(Toast.show).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", text2: "Rejected" }),
    );
  });

  it("does not submit or celebrate offline or for an owned business", async () => {
    const screen = await renderSection();
    onlineManager.setOnline(false);
    const celebrate = jest.fn();
    await act(async () => {
      await mockVouchAction(4, celebrate);
    });
    onlineManager.setOnline(true);
    await screen.unmount();
    await renderSection(true);
    await act(async () => {
      await mockVouchAction(4, celebrate);
    });
    expect(vouch).not.toHaveBeenCalled();
    expect(celebrate).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
