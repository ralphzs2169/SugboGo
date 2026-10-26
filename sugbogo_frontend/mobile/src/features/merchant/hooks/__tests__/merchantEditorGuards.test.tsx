import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import useMerchantEditorExit from "../useMerchantEditorExit";
import useMerchantSheetDraft from "../useMerchantSheetDraft";

const mockBack = jest.fn();
const mockDispatch = jest.fn();
let mockFocused = true;
let mockPrevent: { enabled: boolean; callback: (event: any) => void };
const mockNavigation = {
  setOptions: jest.fn(),
  dispatch: mockDispatch,
  isFocused: () => mockFocused,
};
jest.mock("expo-router", () => ({
  router: { back: () => mockBack() },
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (enabled: boolean, callback: (event: any) => void) => {
    mockPrevent = { enabled, callback };
  },
}));
jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({ HeaderBackButton: () => null }),
);

describe("Merchant editor exit protection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
  });

  it("leaves untouched forms without confirmation", async () => {
    const { result } = await renderHook(() =>
      useMerchantEditorExit(false, false, () => false),
    );
    await act(() => result.current.requestExit());
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(result.current.showDiscard).toBe(false);
  });

  it("keeps drafts, replays a confirmed native removal, and stops warning after revert", async () => {
    const { result, rerender } = await renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useMerchantEditorExit(dirty, false, () => false),
      { initialProps: { dirty: true } },
    );
    const action = { type: "POP" };
    await act(() => mockPrevent.callback({ data: { action } }));
    expect(result.current.showDiscard).toBe(true);
    await act(() => result.current.keepEditing());
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(() => result.current.requestExit());
    await act(() => result.current.discard());
    expect(mockBack).toHaveBeenCalledTimes(1);
    await rerender({ dirty: false });
    expect(mockPrevent.enabled).toBe(false);
  });

  it("dispatches the original gesture action only after Discard", async () => {
    const { result } = await renderHook(() =>
      useMerchantEditorExit(true, false, () => false),
    );
    const action = { type: "POP_TO_TOP" };
    await act(() => mockPrevent.callback({ data: { action } }));
    await act(() => result.current.discard());
    expect(mockDispatch).toHaveBeenCalledWith(action);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("blocks header, hardware and gesture exits while saving, then finishes once", async () => {
    const listeners = jest.spyOn(BackHandler, "addEventListener");
    const { result } = await renderHook(() =>
      useMerchantEditorExit(true, true, () => true),
    );
    await act(() => result.current.requestExit());
    await act(() =>
      mockPrevent.callback({ data: { action: { type: "POP" } } }),
    );
    await act(() => (listeners.mock.lastCall![1] as () => boolean)());
    expect(mockBack).not.toHaveBeenCalled();
    expect(result.current.showDiscard).toBe(false);
    await act(() => {
      result.current.finish();
      result.current.finish();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    listeners.mockRestore();
  });

  it("ignores completion after blur or unmount", async () => {
    const { result, unmount } = await renderHook(() =>
      useMerchantEditorExit(true, true, () => true),
    );
    const finish = result.current.finish;
    mockFocused = false;
    await act(() => finish());
    await unmount();
    mockFocused = true;
    finish();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe("Merchant sheet draft protection", () => {
  beforeEach(() => jest.clearAllMocks());
  function setup(dirty = true) {
    const sheetRef = {
      current: {
        dismiss: jest.fn(),
        snapToIndex: jest.fn(),
        present: jest.fn(),
      },
    } as any;
    return {
      sheetRef,
      render: () =>
        renderHook(
          ({ changed, id }: { changed: boolean; id: number }) =>
            useMerchantSheetDraft(sheetRef, changed, false, id),
          { initialProps: { changed: dirty, id: 1 } },
        ),
    };
  }

  it("restores a dirty pan-closed sheet and preserves it on Keep Editing", async () => {
    const { sheetRef, render } = setup();
    const { result } = await render();
    await act(() => result.current.onChange(0));
    await act(() => result.current.onChange(-1));
    expect(sheetRef.current.present).toHaveBeenCalledTimes(1);
    expect(result.current.showDiscard).toBe(true);
    await act(() => result.current.keepEditing());
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    await act(() => result.current.requestDismiss());
    await act(() => result.current.discard());
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("closes an untouched sheet without confirmation", async () => {
    const { sheetRef, render } = setup(false);
    const { result } = await render();
    await act(() => result.current.onChange(0));
    await act(() => result.current.requestDismiss());
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
    expect(result.current.showDiscard).toBe(false);
  });

  it("routes hardware Back through the sheet's draft confirmation", async () => {
    const listeners = jest.spyOn(BackHandler, "addEventListener");
    const { sheetRef, render } = setup();
    const { result } = await render();
    await act(() => result.current.onChange(0));
    await act(() => (listeners.mock.lastCall![1] as () => boolean)());
    expect(result.current.showDiscard).toBe(true);
    await act(() => result.current.keepEditing());
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    listeners.mockRestore();
  });

  it("blocks all pending exits and duplicates, recovers from failure, and closes once on success", async () => {
    const { sheetRef, render } = setup();
    const { result } = await render();
    await act(() => result.current.onChange(0));
    let token: number | null = null;
    await act(() => {
      token = result.current.beginSave();
    });
    expect(result.current.beginSave()).toBeNull();
    await act(() => {
      result.current.requestDismiss();
      result.current.onChange(-1);
      mockPrevent.callback({ data: { action: {} } });
    });
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    await act(() => result.current.endSave());
    expect(result.current.pending).toBe(false);
    await act(() => result.current.requestDismiss());
    expect(result.current.showDiscard).toBe(true);
    await act(() => {
      result.current.completeSave(token!);
      result.current.completeSave(token!);
    });
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss a different draft when an earlier save completes", async () => {
    const { sheetRef, render } = setup();
    const { result, rerender, unmount } = await render();
    await act(() => result.current.onChange(0));
    let token: number | null = null;
    await act(() => {
      token = result.current.beginSave();
    });
    await rerender({ changed: true, id: 2 });
    await act(() => result.current.completeSave(token!));
    const complete = result.current.completeSave;
    await unmount();
    complete(token!);
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
  });
});
