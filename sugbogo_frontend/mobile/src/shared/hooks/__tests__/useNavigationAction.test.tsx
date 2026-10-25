import { act, renderHook } from "@testing-library/react-native";

import useNavigationAction from "../useNavigationAction";

let mockFocus: () => void | (() => void);
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocus = effect;
    jest.requireActual("react").useEffect(effect, [effect]);
  },
}));

it("blocks two route dispatches before focus changes and releases on return", async () => {
  const action = jest.fn();
  const { result } = await renderHook(useNavigationAction);
  await act(() => {
    result.current(action);
    result.current(action);
  });
  expect(action).toHaveBeenCalledTimes(1);
  await act(() => {
    mockFocus();
  });
  await act(() => {
    result.current(action);
  });
  expect(action).toHaveBeenCalledTimes(2);
});

it("guards retained callbacks after blur and releases failed or unhandled dispatches", async () => {
  const { result } = await renderHook(useNavigationAction);
  const action = jest.fn();
  await act(() => {
    expect(() =>
      result.current(() => {
        throw new Error("Dispatch failed");
      }),
    ).toThrow("Dispatch failed");
    result.current(() => false);
    result.current(action);
  });
  expect(action).toHaveBeenCalledTimes(1);
  const blur = mockFocus();
  if (blur) blur();
  result.current(action);
  expect(action).toHaveBeenCalledTimes(1);
});
