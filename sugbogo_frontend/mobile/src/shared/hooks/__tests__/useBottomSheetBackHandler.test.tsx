import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import useBottomSheetBackHandler from "../useBottomSheetBackHandler";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

describe("sheet Android back handling", () => {
  afterEach(() => jest.restoreAllMocks());

  it("consumes back only while open and preserves dismissal callbacks", async () => {
    const remove = jest.fn();
    let pressBack!: () => boolean | null | undefined;
    const subscribe = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_, handler) => {
        pressBack = () => handler({} as Parameters<typeof handler>[0]);
        return { remove };
      });
    const dismiss = jest.fn();
    const ref = { current: { dismiss } as unknown as BottomSheetModal };
    const { result, unmount } = await renderHook(() =>
      useBottomSheetBackHandler(ref),
    );
    expect(subscribe).not.toHaveBeenCalled();
    await act(() => result.current.onChange(0));
    expect(pressBack()).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
    await act(() => result.current.onChange(-1));
    expect(remove).not.toHaveBeenCalled();
    await act(() => result.current.onDismiss());
    expect(remove).toHaveBeenCalledTimes(1);
    await act(() => result.current.onChange(0));
    expect(subscribe).toHaveBeenCalledTimes(2);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("does not intercept another screen's back events after losing focus", async () => {
    mockFocused = true;
    const remove = jest.fn();
    const subscribe = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove });
    const ref = { current: null };
    const { result, rerender } = await renderHook(() =>
      useBottomSheetBackHandler(ref),
    );
    await act(() => result.current.onChange(0));
    expect(subscribe).toHaveBeenCalledTimes(1);
    mockFocused = false;
    await rerender(undefined);
    expect(remove).toHaveBeenCalledTimes(1);
    mockFocused = true;
  });
});
