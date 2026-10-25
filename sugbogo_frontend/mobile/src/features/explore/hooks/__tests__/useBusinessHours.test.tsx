import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import type { ExploreOperatingHours } from "../../types/exploreBusiness.types";
import useBusinessHours from "../useBusinessHours";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

const operatingHours: ExploreOperatingHours[] = [
  {
    id: 1,
    day: "monday",
    is_open: true,
    is_24_hours: false,
    open_time: "08:00:00",
    close_time: "20:30:00",
  },
];

describe("local business-hours clock", () => {
  let changeAppState: (state: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-11T23:59:59Z"));
    mockFocused = true;
    AppState.currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, listener) => {
        changeAppState = listener;
        return { remove };
      });
    remove.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("updates at opening, closing and Manila midnight without polling", async () => {
    const hook = await renderHook(() => useBusinessHours(operatingHours));
    expect(hook.result.current.status).toBe("closed");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(hook.result.current.status).toBe("open");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(12.5 * 60 * 60_000);
    });
    expect(hook.result.current.status).toBe("closed");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3.5 * 60 * 60_000);
    });
    expect(hook.result.current.currentDay).toBe("tuesday");
    expect(hook.result.current.status).toBe("unavailable");
    await hook.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("stops its timer in the background and recalculates immediately on resume", async () => {
    const hook = await renderHook(() => useBusinessHours(operatingHours));
    await act(async () => changeAppState("background"));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(hook.result.current.status).toBe("closed");
    await act(async () => changeAppState("active"));
    expect(hook.result.current.status).toBe("open");
    await hook.unmount();
  });

  it("recalculates on route return and after schedule changes", async () => {
    const hook = await renderHook(
      ({ schedule }) => useBusinessHours(schedule),
      { initialProps: { schedule: operatingHours } },
    );
    mockFocused = false;
    await hook.rerender({ schedule: operatingHours });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(hook.result.current.status).toBe("closed");
    mockFocused = true;
    await hook.rerender({ schedule: operatingHours });
    expect(hook.result.current.status).toBe("open");
    await hook.rerender({
      schedule: [{ ...operatingHours[0], close_time: "08:00:30" }],
    });
    expect(hook.result.current.status).toBe("closed");
    await hook.unmount();
  });

  it("does not install a live clock for saved read-only hours", async () => {
    const hook = await renderHook(() =>
      useBusinessHours(operatingHours, false),
    );
    expect(AppState.addEventListener).not.toHaveBeenCalled();
    await hook.unmount();
  });
});
