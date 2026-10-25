import { act, fireEvent, render } from "@testing-library/react-native";

import BusinessSpecialtyVouchCard from "../BusinessSpecialtyVouchCard";

const mockPlay = jest.fn();
const mockCancel = jest.fn();
const mockSetPressed = jest.fn();
let mockBlur: () => void;
const mockNavigation = {
  isFocused: () => true,
  addListener: jest.fn((_event, callback) => {
    mockBlur = callback;
    return jest.fn();
  }),
};

jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@/shared/components/ParticleBurst", () => {
  const React = jest.requireActual("react");
  return {
    __esModule: true,
    default: React.forwardRef(function MockBurst(
      { children }: React.PropsWithChildren,
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        play: mockPlay,
        cancel: mockCancel,
        setPressed: mockSetPressed,
      }));
      return children;
    }),
  };
});

const props = {
  name: "Coffee",
  color: "blue" as const,
  vouchCount: 2,
  isVouched: false,
};

describe("optimistic vouch celebration", () => {
  it("responds to touch without submitting or celebrating before the tap completes", async () => {
    const onPress = jest.fn();
    const screen = await render(
      <BusinessSpecialtyVouchCard {...props} onPress={onPress} />,
    );
    await fireEvent(screen.getByRole("button"), "pressIn");
    expect(mockSetPressed).toHaveBeenLastCalledWith(true);
    expect(onPress).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
    await fireEvent(screen.getByRole("button"), "pressOut");
    expect(mockSetPressed).toHaveBeenLastCalledWith(false);
  });

  it("keeps accepting taps while saving without replaying from cache updates or responses", async () => {
    let resolve!: (confirmed: boolean) => void;
    const onPress = jest.fn((onAccepted?: () => void) => {
      onAccepted?.();
      return new Promise<boolean>((done) => {
        resolve = done;
      });
    });
    const screen = await render(
      <BusinessSpecialtyVouchCard {...props} onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole("button"));
    expect(mockPlay).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(2);
    await screen.rerender(
      <BusinessSpecialtyVouchCard {...props} isVouched onPress={onPress} />,
    );
    expect(mockPlay).toHaveBeenCalledTimes(2);
    await act(async () => resolve(true));
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it("never waits for a failed response to start or replay the optimistic burst", async () => {
    let resolve!: (confirmed: boolean) => void;
    const onPress = (onAccepted?: () => void) => {
      onAccepted?.();
      return new Promise<boolean>((done) => {
        resolve = done;
      });
    };
    const screen = await render(
      <BusinessSpecialtyVouchCard {...props} onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole("button"));
    expect(mockPlay).toHaveBeenCalledTimes(1);
    await screen.rerender(
      <BusinessSpecialtyVouchCard {...props} onPress={onPress} />,
    );
    await act(async () => resolve(false));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate removal or a blocked action", async () => {
    const screen = await render(
      <BusinessSpecialtyVouchCard
        {...props}
        isVouched
        onPress={async () => false}
      />,
    );
    await fireEvent.press(screen.getByRole("button"));
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it.each(["blur", "dismiss", "unmount"])(
    "does not replay after late settlement following %s",
    async (action) => {
      let resolve!: (confirmed: boolean) => void;
      const onPress = (onAccepted?: () => void) => {
        onAccepted?.();
        return new Promise<boolean>((done) => {
          resolve = done;
        });
      };
      const screen = await render(
        <BusinessSpecialtyVouchCard {...props} onPress={onPress} />,
      );
      await fireEvent.press(screen.getByRole("button"));
      expect(mockPlay).toHaveBeenCalledTimes(1);
      if (action === "blur") await act(async () => mockBlur());
      if (action === "dismiss") {
        await screen.rerender(
          <BusinessSpecialtyVouchCard
            {...props}
            onPress={onPress}
            celebrationEnabled={false}
          />,
        );
      }
      if (action === "unmount") await screen.unmount();
      if (action !== "unmount") expect(mockCancel).toHaveBeenCalled();
      await act(async () => resolve(true));
      expect(mockPlay).toHaveBeenCalledTimes(1);
    },
  );
});
