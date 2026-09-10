import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { AppState, type LayoutChangeEvent } from "react-native";

import {
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../../api/exploreBusiness.service";
import {
  useRecordBusinessImpressions,
  useRecordBusinessProfileVisit,
} from "../useVisibilityMutations";
import useBusinessProfileVisit from "../useBusinessProfileVisit";
import useBusinessImpressions from "../useBusinessImpressions";
import useBusinessPocket from "../useBusinessPocket";
import * as service from "../../api/exploreBusiness.service";

let mockFocused = true;
jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock("../../api/exploreBusiness.service", () => ({
  recordBusinessImpressions: jest.fn(),
  recordBusinessProfileVisit: jest.fn(),
  pocketBusiness: jest.fn(),
  removeBusinessFromPocket: jest.fn(),
}));

const success = { success: true, data: {} };
const unavailable = {
  success: false,
  code: "VISIBILITY_TRACKING_UNAVAILABLE",
  message: "Unavailable",
};

function setupClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });

  /** Supplies a real query client to the hook under test. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, wrapper: Wrapper };
}

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    // Query notifications are synchronous callbacks outside RNTL's async act.
    const previousEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(callback);
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
    }
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
});

beforeEach(() => {
  mockFocused = true;
  AppState.currentState = "active";
  (recordBusinessImpressions as jest.Mock).mockResolvedValue(success);
  (recordBusinessProfileVisit as jest.Mock).mockResolvedValue(success);
});

describe("real React Query visibility mutations", () => {
  it("writes both events without changing or invalidating business caches", async () => {
    const { client, wrapper } = setupClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    client.setQueryData(["explore-new-businesses"], { items: [1] });
    client.setQueryData(["explore-discovery"], { items: [2] });
    const { result } = await renderHook(
      () => ({
        impressions: useRecordBusinessImpressions(),
        visit: useRecordBusinessProfileVisit(),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.impressions.mutateAsync([1, 2]);
      await result.current.visit.mutateAsync(1);
    });

    expect(recordBusinessImpressions).toHaveBeenCalledWith([1, 2]);
    expect(recordBusinessProfileVisit).toHaveBeenCalledWith(1);
    expect(client.getMutationCache().getAll()).toHaveLength(2);
    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryData(["explore-new-businesses"])).toEqual({
      items: [1],
    });
    expect(client.getQueryData(["explore-discovery"])).toEqual({ items: [2] });
  });

  it("retries a transient failure once and settles silently after the final failure", async () => {
    (recordBusinessImpressions as jest.Mock).mockResolvedValue(unavailable);
    const { wrapper } = setupClient();
    const { result } = await renderHook(useRecordBusinessImpressions, {
      wrapper,
    });
    await act(async () => result.current.mutate([1]));
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3000,
    });
    expect(recordBusinessImpressions).toHaveBeenCalledTimes(2);
  });

  it("does not retry validation or expired-session failures", async () => {
    (recordBusinessProfileVisit as jest.Mock).mockResolvedValue({
      ...unavailable,
      code: "SESSION_EXPIRED",
    });
    const { wrapper } = setupClient();
    const { result } = await renderHook(useRecordBusinessProfileVisit, {
      wrapper,
    });
    await act(async () => result.current.mutate(1));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing optimistic Pocket mutation without producing visibility writes", async () => {
    (service.pocketBusiness as jest.Mock).mockResolvedValue(success);
    const { client, wrapper } = setupClient();
    client.setQueryData(["explore-business-detail", 1], {
      id: 1,
      is_pocketed: false,
    });
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 1 }),
      { wrapper },
    );
    await act(async () => {
      await result.current.pocket({ isPocketed: false });
    });
    expect(service.pocketBusiness).toHaveBeenCalledWith(1);
    expect(client.getQueryData(["explore-business-detail", 1])).toMatchObject({
      is_pocketed: true,
    });
    expect(recordBusinessImpressions).not.toHaveBeenCalled();
    expect(recordBusinessProfileVisit).not.toHaveBeenCalled();
  });
});

describe("displayed profile lifecycle", () => {
  it("waits for displayed matching content and suppresses ordinary rerenders", async () => {
    const { wrapper } = setupClient();
    const { rerender } = await renderHook(
      ({ id, displayed }: { id: number; displayed?: number }) =>
        useBusinessProfileVisit(id, displayed),
      { wrapper, initialProps: { id: 1, displayed: undefined } },
    );
    expect(recordBusinessProfileVisit).not.toHaveBeenCalled();
    await rerender({ id: 1, displayed: 1 });
    await waitFor(() =>
      expect(recordBusinessProfileVisit).toHaveBeenCalledWith(1),
    );
    await rerender({ id: 1, displayed: 1 });
    expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(1);
    mockFocused = false;
    await rerender({ id: 1, displayed: 1 });
    mockFocused = true;
    await rerender({ id: 1, displayed: 1 });
    await waitFor(() =>
      expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(2),
    );
    await rerender({ id: 2, displayed: 1 });
    expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(2);
    await rerender({ id: 2, displayed: 2 });
    await waitFor(() =>
      expect(recordBusinessProfileVisit).toHaveBeenCalledWith(2),
    );
  });

  it("does not record failed/absent data, an invalid route, or an unfocused profile", async () => {
    const { wrapper } = setupClient();
    const { rerender } = await renderHook(
      ({ id, displayed }: { id: number; displayed?: number }) =>
        useBusinessProfileVisit(id, displayed),
      { wrapper, initialProps: { id: 0, displayed: 0 } },
    );
    await rerender({ id: 1, displayed: undefined });
    mockFocused = false;
    await rerender({ id: 1, displayed: 1 });
    expect(recordBusinessProfileVisit).not.toHaveBeenCalled();
  });

  it("accepts cached content immediately and does not spam after tracking failure", async () => {
    (recordBusinessProfileVisit as jest.Mock).mockResolvedValue({
      ...unavailable,
      code: "VALIDATION_ERROR",
    });
    const { wrapper } = setupClient();
    const { rerender } = await renderHook(() => useBusinessProfileVisit(1, 1), {
      wrapper,
    });
    await waitFor(() =>
      expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(1),
    );
    await rerender(undefined);
    expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(1);
  });
});

describe("nested ScrollView observation", () => {
  function layout(x: number, y: number, width: number, height: number) {
    return {
      nativeEvent: { layout: { x, y, width, height } },
    } as LayoutChangeEvent;
  }

  it("requires visible layout in both axes, preserves callbacks, and clears timers", async () => {
    jest.useFakeTimers();
    const { wrapper } = setupClient();
    const { result, rerender, unmount } = await renderHook(
      () => useBusinessImpressions(100),
      { wrapper },
    );
    const first = result.current;
    await act(async () => {
      first.retainBusinesses([1, 2]);
      first.onViewportLayout(layout(0, 0, 400, 800));
      first.onSectionLayout(layout(0, 1000, 400, 400));
      first.onListLayout(layout(0, 50, 400, 300));
      first.onCardLayout(1, layout(0, 0, 200, 300));
      first.onCardLayout(2, layout(500, 0, 200, 300));
      jest.advanceTimersByTime(2000);
    });
    expect(recordBusinessImpressions).not.toHaveBeenCalled();

    await act(async () => {
      first.onVerticalScroll({
        nativeEvent: { contentOffset: { x: 0, y: 700 } },
      } as Parameters<typeof first.onVerticalScroll>[0]);
      jest.advanceTimersByTime(1250);
    });
    expect(recordBusinessImpressions).toHaveBeenCalledWith([1]);
    await rerender(undefined);
    expect(result.current.onVerticalScroll).toBe(first.onVerticalScroll);
    expect(result.current.onHorizontalScroll).toBe(first.onHorizontalScroll);
    expect(result.current.onCardLayout).toBe(first.onCardLayout);

    await act(async () => {
      first.onHorizontalScroll({
        nativeEvent: { contentOffset: { x: 400, y: 0 } },
      } as Parameters<typeof first.onHorizontalScroll>[0]);
      jest.advanceTimersByTime(200);
    });
    mockFocused = false;
    await rerender(undefined);
    await act(async () => jest.advanceTimersByTime(2000));
    expect(recordBusinessImpressions).toHaveBeenCalledTimes(1);
    await unmount();
    await act(async () => jest.runOnlyPendingTimers());
    expect(recordBusinessImpressions).toHaveBeenCalledTimes(1);
    // Tracker-owned timer cancellation is asserted separately from Query/React timers.
    jest.useRealTimers();
  });
});
