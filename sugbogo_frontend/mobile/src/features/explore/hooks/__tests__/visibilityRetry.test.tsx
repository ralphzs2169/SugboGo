import React, { type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState } from "react-native";

import {
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../../api/exploreBusiness.service";
import {
  useRecordBusinessImpressions,
  useRecordBusinessProfileVisit,
} from "../useVisibilityMutations";
import useBusinessProfileVisit from "../useBusinessProfileVisit";
import { createBusinessImpressionTracker } from "../../utils/businessImpressions";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/exploreBusiness.service", () => ({
  recordBusinessImpressions: jest.fn(),
  recordBusinessProfileVisit: jest.fn(),
}));

const impressions = jest.mocked(recordBusinessImpressions);
const visits = jest.mocked(recordBusinessProfileVisit);
const success = {
  success: true as const,
  message: "Recorded",
  data: { business_ids: [1], recorded_count: 1, duplicate_count: 0 },
};
const visitSuccess = {
  success: true as const,
  message: "Recorded",
  data: { business_id: 1, recorded: true, duplicate: false },
};
const unavailable = {
  success: false as const,
  code: "VISIBILITY_TRACKING_UNAVAILABLE",
  message: "Unavailable",
  retry_after: 30,
};
let client: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function advance(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("visibility retry reliability", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocused = true;
    AppState.currentState = "active";
    client = new QueryClient({
      defaultOptions: { mutations: { gcTime: Infinity } },
    });
    impressions.mockReset().mockResolvedValue(success);
    visits.mockReset().mockResolvedValue(visitSuccess);
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("waits for server cooldown and delivers one retry without duplicate timers", async () => {
    impressions.mockResolvedValueOnce(unavailable);
    const timer = jest.spyOn(global, "setTimeout");
    const { result, rerender } = await renderHook(
      useRecordBusinessImpressions,
      { wrapper: Wrapper },
    );
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync([1]);
    });
    await rerender(undefined);
    await rerender(undefined);
    expect(
      timer.mock.calls.filter(([, delay]) => delay === 30000),
    ).toHaveLength(1);
    await advance(29999);
    expect(impressions).toHaveBeenCalledTimes(1);
    await advance(1);
    await expect(delivery).resolves.toEqual(success.data);
    expect(impressions.mock.calls).toEqual([[[1]], [[1]]]);
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(2);
  });

  it("retries profile visits with the original identity and source", async () => {
    visits.mockResolvedValueOnce({ ...unavailable, retry_after: 1.25 });
    const { result } = await renderHook(useRecordBusinessProfileVisit, {
      wrapper: Wrapper,
    });
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync({
        businessId: 1,
        discoverySource: "MAP",
      });
    });
    await advance(1249);
    expect(visits).toHaveBeenCalledTimes(1);
    await advance(1);
    await expect(delivery).resolves.toEqual(visitSuccess.data);
    expect(visits.mock.calls).toEqual([
      [1, "MAP"],
      [1, "MAP"],
    ]);
  });

  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"])(
    "keeps a bounded transport retry for %s",
    async (code) => {
      impressions.mockResolvedValueOnce({ ...unavailable, code });
      const { result } = await renderHook(useRecordBusinessImpressions, {
        wrapper: Wrapper,
      });
      let delivery!: Promise<unknown>;
      await act(async () => {
        delivery = result.current.mutateAsync([1]);
      });
      await advance(999);
      expect(impressions).toHaveBeenCalledTimes(1);
      await advance(1);
      await expect(delivery).resolves.toEqual(success.data);
      expect(impressions).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    "SESSION_EXPIRED",
    "AUTHENTICATION_FAILED",
    "PERMISSION_DENIED",
    "VALIDATION_ERROR",
    "NOT_FOUND",
    "RATE_LIMIT_EXCEEDED",
    "UNKNOWN_ERROR",
  ])("does not retry %s", async (code) => {
    impressions.mockResolvedValue({ ...unavailable, code });
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.mutateAsync([1])).rejects.toMatchObject({
        code,
      });
    });
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(1);
  });

  it("does not guess cooldown timing when metadata is missing or invalid", async () => {
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    for (const retry_after of [
      undefined,
      "30",
      -1,
      Infinity,
      Number.NaN,
      2147484,
    ]) {
      impressions.mockResolvedValue({
        ...unavailable,
        retry_after,
      } as typeof unavailable);
      await act(async () => {
        await expect(result.current.mutateAsync([1])).rejects.toMatchObject({
          code: unavailable.code,
        });
      });
    }
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(6);
  });

  it("stops after the second failed attempt", async () => {
    impressions.mockResolvedValue(unavailable);
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync([1]).catch((error) => error);
    });
    await advance(30000);
    await expect(delivery).resolves.toEqual(unavailable);
    await advance(300000);
    expect(impressions).toHaveBeenCalledTimes(2);
  });

  it("clears the retry timer and sends no delayed request after unmount", async () => {
    impressions.mockResolvedValueOnce(unavailable);
    const timer = jest.spyOn(global, "setTimeout");
    const clear = jest.spyOn(global, "clearTimeout");
    const { result, unmount } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync([1]).catch((error) => error);
    });
    const timerIndex = timer.mock.calls.findIndex(
      ([, delay]) => delay === 30000,
    );
    expect(timerIndex).toBeGreaterThanOrEqual(0);
    const retryTimer = timer.mock.results[timerIndex].value;
    await unmount();
    await expect(delivery).resolves.toEqual(unavailable);
    expect(clear).toHaveBeenCalledWith(retryTimer);
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(1);
  });

  it("does not schedule a retry for an in-flight failure received after unmount", async () => {
    let finish!: (response: typeof unavailable) => void;
    impressions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const timer = jest.spyOn(global, "setTimeout");
    const { result, unmount } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync([1]).catch((error) => error);
    });
    await unmount();
    await act(async () => {
      finish(unavailable);
    });
    await expect(delivery).resolves.toEqual(unavailable);
    expect(
      timer.mock.calls.filter(([, delay]) => delay === 30000),
    ).toHaveLength(0);
    expect(impressions).toHaveBeenCalledTimes(1);
  });

  it("cancels pending retries at an authentication session boundary", async () => {
    beginAuthSession();
    impressions.mockResolvedValueOnce(unavailable);
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    let delivery!: Promise<unknown>;
    await act(async () => {
      delivery = result.current.mutateAsync([1]).catch((error) => error);
    });
    await act(async () => {
      invalidateAuthSession();
      beginAuthSession();
    });
    await expect(delivery).resolves.toEqual(unavailable);
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.mutateAsync([2]);
    });
    expect(impressions.mock.calls).toEqual([[[1]], [[2]]]);
  });

  it("releases final impression failures for a future encounter and retains successful reservations", async () => {
    impressions.mockResolvedValue(unavailable);
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper: Wrapper,
    });
    const tracker = createBusinessImpressionTracker((ids) =>
      result.current.mutateAsync(ids),
    );
    tracker.updateVisible([1]);
    await advance(1250);
    tracker.updateVisible([]);
    tracker.updateVisible([1]);
    await advance(1250);
    expect(impressions).toHaveBeenCalledTimes(1);
    await advance(30000);
    expect(impressions).toHaveBeenCalledTimes(2);
    impressions.mockResolvedValue(success);
    tracker.updateVisible([]);
    tracker.updateVisible([1]);
    await advance(1250);
    expect(impressions).toHaveBeenCalledTimes(3);
    tracker.updateVisible([]);
    tracker.updateVisible([1]);
    await advance(60000);
    expect(impressions).toHaveBeenCalledTimes(3);
    tracker.dispose();
  });

  it("allows a future profile focus encounter after final failure", async () => {
    visits.mockResolvedValue(unavailable);
    const { rerender } = await renderHook(() => useBusinessProfileVisit(1, 1), {
      wrapper: Wrapper,
    });
    await advance(30000);
    expect(visits).toHaveBeenCalledTimes(2);
    visits.mockResolvedValue(visitSuccess);
    mockFocused = false;
    await rerender(undefined);
    mockFocused = true;
    await rerender(undefined);
    expect(visits).toHaveBeenCalledTimes(3);
  });
});
