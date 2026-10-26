import type { PropsWithChildren } from "react";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Location from "expo-location";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import useUserLocation, {
  RECENT_LOCATION_MAX_AGE_MS,
  USER_LOCATION_QUERY_KEY,
} from "../useUserLocation";

jest.mock("expo-location", () => ({
  Accuracy: {
    High: 6,
  },
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

describe("useUserLocation", () => {
  let client: QueryClient;
  const fix = () =>
    ({
      timestamp: Date.now(),
      coords: { latitude: 10.3, longitude: 123.88, accuracy: 20 },
    }) as Location.LocationObject;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    jest
      .mocked(Location.requestForegroundPermissionsAsync)
      .mockResolvedValue({ status: "granted" } as never);
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockResolvedValue({ status: "granted" } as never);
    jest
      .mocked(Location.getCurrentPositionAsync)
      .mockImplementation(async () => fix());
  });
  afterEach(async () => {
    await client.cancelQueries();
    client.clear();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    jest.useRealTimers();
  });

  it("reports an available one-time location snapshot", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: "granted",
      },
    );
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 10.3,
        longitude: 123.88,
        accuracy: 20,
      },
    });

    const { result } = await renderHook(useUserLocation, { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe("available"));

    expect(result.current.latitude).toBe(10.3);
    expect(result.current.longitude).toBe(123.88);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.High,
    });
  });

  it("distinguishes denied permission from a location request failure", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: "denied",
      },
    );

    const { result } = await renderHook(useUserLocation, { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe("denied"));

    expect(result.current.location).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("shares one native acquisition between concurrent consumers and explicit refreshes", async () => {
    let resolve!: (value: Location.LocationObject) => void;
    jest.mocked(Location.getCurrentPositionAsync).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    const second = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1),
    );
    const location = fix();
    await act(async () => {
      const refreshes = [
        first.result.current.refreshLocation(),
        second.result.current.refreshLocation(),
      ];
      resolve(location);
      await Promise.all(refreshes);
    });
    await waitFor(() =>
      expect(second.result.current.location).toEqual(location),
    );
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("reuses an eligible snapshot across rapid profile navigation without acquiring GPS", async () => {
    const acquired = await renderHook(
      () => useUserLocation({ mode: "recent" }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(acquired.result.current.status).toBe("available"),
    );
    const timestamp = acquired.result.current.location!.timestamp;
    await acquired.unmount();
    for (let index = 0; index < 3; index += 1) {
      const profile = await renderHook(
        () => useUserLocation({ mode: "cached" }),
        { wrapper: Wrapper },
      );
      await waitFor(() =>
        expect(profile.result.current.status).toBe("available"),
      );
      expect(profile.result.current.location?.timestamp).toBe(timestamp);
      await profile.unmount();
    }
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("reuses recent coordinates on remount but explicit refresh acquires a new fix", async () => {
    const first = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(first.result.current.status).toBe("available"));
    const original = first.result.current.location!;
    await first.unmount();
    const reopened = await renderHook(
      () => useUserLocation({ mode: "recent" }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(reopened.result.current.status).toBe("available"),
    );
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(reopened.result.current.location?.timestamp).toBe(
      original.timestamp,
    );
    const moved = { ...fix(), coords: { ...original.coords, latitude: 10.4 } };
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(moved);
    await act(async () => {
      await reopened.result.current.refreshLocation();
    });
    await waitFor(() => expect(reopened.result.current.latitude).toBe(10.4));
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
  });

  it("keeps current-mode navigation reads fresh on mount", async () => {
    client.setQueryData(USER_LOCATION_QUERY_KEY, {
      status: "available",
      location: fix(),
      error: null,
    });
    const hook = await renderHook(useUserLocation, { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("does not let an in-flight cached permission check satisfy explicit fresh acquisition", async () => {
    client.setQueryData(USER_LOCATION_QUERY_KEY, {
      status: "available",
      location: fix(),
      error: null,
    });
    let resolvePermission!: (value: never) => void;
    jest.mocked(Location.getForegroundPermissionsAsync).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await hook.result.current.refreshLocation();
    });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePermission({ status: "granted" } as never);
    });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
  });

  it("does not replace a navigation origin when another consumer refreshes shared coordinates", async () => {
    const navigation = await renderHook(useUserLocation, { wrapper: Wrapper });
    await waitFor(() =>
      expect(navigation.result.current.status).toBe("available"),
    );
    const origin = navigation.result.current.location;
    const explore = await renderHook(
      () => useUserLocation({ mode: "recent" }),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(explore.result.current.status).toBe("available"),
    );
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      ...fix(),
      coords: { ...fix().coords, latitude: 10.5 },
    });
    await act(async () => {
      await explore.result.current.refreshLocation();
    });
    await waitFor(() => expect(explore.result.current.latitude).toBe(10.5));
    expect(navigation.result.current.location).toEqual(origin);
    expect(navigation.result.current.status).toBe("available");
  });

  it("does not report an old native GPS timestamp as a newly acquired recent fix", async () => {
    const location = {
      ...fix(),
      timestamp: Date.now() - RECENT_LOCATION_MAX_AGE_MS,
    };
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(location);
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("unavailable"));
    await act(async () => {
      expect(await hook.result.current.refreshLocation()).toMatchObject({
        status: "unavailable",
        location: null,
      });
    });
    expect(hook.result.current.location).toBeNull();
  });

  it("leaves a disabled consumer inactive", async () => {
    const hook = await renderHook(() => useUserLocation({ enabled: false }), {
      wrapper: Wrapper,
    });
    expect(hook.result.current.status).toBe("unavailable");
    await act(async () => {
      await hook.result.current.refreshLocation();
    });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each(["absent", "expired"])(
    "cached-only consumers leave %s coordinates unavailable",
    async (state) => {
      if (state === "expired") {
        client.setQueryData(USER_LOCATION_QUERY_KEY, {
          status: "available",
          location: {
            ...fix(),
            timestamp: Date.now() - RECENT_LOCATION_MAX_AGE_MS,
          },
          error: null,
        });
      }
      const hook = await renderHook(() => useUserLocation({ mode: "cached" }), {
        wrapper: Wrapper,
      });
      await waitFor(() =>
        expect(hook.result.current.isRefreshingLocation).toBe(false),
      );
      expect(hook.result.current.location).toBeNull();
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    },
  );

  it("expires a mounted cached snapshot without renewing its acquisition timestamp", async () => {
    jest.useFakeTimers();
    const location = fix();
    client.setQueryData(USER_LOCATION_QUERY_KEY, {
      status: "available",
      location,
      error: null,
    });
    const hook = await renderHook(() => useUserLocation({ mode: "cached" }), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(hook.result.current.status).toBe("available");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(RECENT_LOCATION_MAX_AGE_MS);
    });
    expect(hook.result.current.location).toBeNull();
    expect(hook.result.current.status).toBe("unavailable");
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("rechecks cached permission and removes the snapshot when access was revoked", async () => {
    client.setQueryData(USER_LOCATION_QUERY_KEY, {
      status: "available",
      location: fix(),
      error: null,
    });
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockResolvedValue({ status: "denied" } as never);
    const hook = await renderHook(() => useUserLocation({ mode: "cached" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("denied"));
    expect(hook.result.current.location).toBeNull();
    expect(client.getQueryData(USER_LOCATION_QUERY_KEY)).toMatchObject({
      status: "denied",
      location: null,
    });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("reports GPS failure and can recover explicitly while the network is offline", async () => {
    onlineManager.setOnline(false);
    jest
      .mocked(Location.getCurrentPositionAsync)
      .mockRejectedValueOnce(new Error("GPS unavailable"));
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("unavailable"));
    expect(hook.result.current.location).toBeNull();
    await act(async () => {
      await hook.result.current.refreshLocation();
    });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
  });

  it("revalidates location on foreground return and reacquires an expired fix", async () => {
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
    await act(async () => focusManager.setFocused(false));
    const location = hook.result.current.location!;
    await act(async () => {
      client.setQueryData(USER_LOCATION_QUERY_KEY, {
        status: "available",
        location: {
          ...location,
          timestamp: Date.now() - RECENT_LOCATION_MAX_AGE_MS,
        },
        error: null,
      });
      focusManager.setFocused(true);
    });
    await waitFor(() =>
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
  });

  it("keeps denied passive checks quiet and leaves permission requests to explicit retry", async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as never);
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("denied"));
    await act(async () => focusManager.setFocused(false));
    await act(async () => focusManager.setFocused(true));
    await waitFor(() =>
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2),
    );
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();

    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as never);
    await act(async () => {
      await hook.result.current.refreshLocation();
    });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("preserves the initial permission request when permission is undetermined", async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: "undetermined",
    } as never);
    const hook = await renderHook(() => useUserLocation({ mode: "recent" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.status).toBe("available"));
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("expires a mounted recent fix without polling GPS and replaces it on reactivation", async () => {
    jest.useFakeTimers();
    const hook = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useUserLocation({ mode: "recent", enabled }),
      { wrapper: Wrapper, initialProps: { enabled: true } },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(hook.result.current.status).toBe("available");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(RECENT_LOCATION_MAX_AGE_MS);
    });
    expect(hook.result.current.location).toBeNull();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    await hook.rerender({ enabled: false });
    await hook.rerender({ enabled: true });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe("available");
  });
});
