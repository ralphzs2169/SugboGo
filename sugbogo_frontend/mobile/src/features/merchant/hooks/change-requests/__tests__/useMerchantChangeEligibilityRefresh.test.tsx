import { act, renderHook } from "@testing-library/react-native";

import useMerchantChangeEligibilityRefresh from "../useMerchantChangeEligibilityRefresh";

const mockUseFocusEffect = jest.fn();

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) => mockUseFocusEffect(callback),
}));

describe("useMerchantChangeEligibilityRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseFocusEffect.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("refetches on later focus without duplicating the initial query", async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);

    await renderHook(() => useMerchantChangeEligibilityRefresh(null, refetch));
    const focusedCallback = mockUseFocusEffect.mock.lastCall?.[0];

    await act(async () => {
      focusedCallback?.();
    });
    expect(refetch).not.toHaveBeenCalled();

    await act(async () => {
      focusedCallback?.();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("refetches when the server-provided cooldown expires", async () => {
    const now = new Date("2026-10-09T07:00:00Z");
    jest.setSystemTime(now);
    const refetch = jest.fn().mockResolvedValue(undefined);

    await renderHook(() =>
      useMerchantChangeEligibilityRefresh(
        {
          can_submit: false,
          reason: "cooldown",
          cooldown_duration_hours: 168,
          cooldown_until: "2026-10-09T07:00:01Z",
          last_approved_request_id: 42,
          pending_request_id: null,
        },
        refetch,
      ),
    );
    await act(async () => undefined);

    await act(async () => {
      jest.advanceTimersByTime(1_250);
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
