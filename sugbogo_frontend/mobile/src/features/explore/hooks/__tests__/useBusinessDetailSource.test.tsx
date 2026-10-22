import { act, renderHook, waitFor } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "@/features/auth/store/auth.store";
import useOfflineBusinessSnapshots from "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots";
import {
  businessFixture,
  snapshotFixture,
} from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import {
  recentBusinessDetails,
  RECENT_BUSINESS_LIMITS,
} from "../../services/recentBusinessDetails.service";
import useBusinessDetailSource from "../useBusinessDetailSource";
import useExploreBusinessProfile from "../useExploreBusinessProfile";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../useExploreBusinessProfile");
jest.mock("@/features/offline-pockets/hooks/useOfflineBusinessSnapshots");

const refetch = jest.fn();
function missingPocket(status = "missing") {
  return {
    ownerId: 7,
    isPending: false,
    isError: false,
    data: {
      context: {
        sessionGeneration: getAuthSessionGeneration(),
        apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      },
      entries: [{ businessId: 21, status, snapshot: null }],
      covers: {},
    },
  };
}

beforeEach(async () => {
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  await recentBusinessDetails.flush();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  onlineManager.setOnline(false);
  jest.mocked(useExploreBusinessProfile).mockReturnValue({
    business: null,
    error: { success: false, code: "NETWORK_ERROR" },
    isLoading: false,
    isPaused: false,
    isFetching: false,
    refetch,
  } as never);
  jest
    .mocked(useOfflineBusinessSnapshots)
    .mockReturnValue(missingPocket() as never);
});

afterEach(async () => {
  invalidateAuthSession();
  await recentBusinessDetails.flush();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

it("prefers live detail and disables local Pocket reads", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  onlineManager.setOnline(true);
  jest.mocked(useExploreBusinessProfile).mockReturnValue({
    business: businessFixture(),
    error: null,
    isPaused: false,
  } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  expect(hook.result.current.source).toBe("live");
  expect(jest.mocked(useOfflineBusinessSnapshots).mock.calls.at(-1)).toEqual([
    21,
    false,
  ]);
});

it("does not hide successful live data when temporary-cache cleanup fails", async () => {
  jest
    .spyOn(AsyncStorage, "removeItem")
    .mockRejectedValueOnce(new Error("storage failed"));
  beginAuthSession();
  await recentBusinessDetails.flush();
  onlineManager.setOnline(true);
  jest.mocked(useExploreBusinessProfile).mockReturnValue({
    business: businessFixture(),
    error: null,
    isPaused: false,
  } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  expect(hook.result.current.source).toBe("live");
});

it("prefers a readable Pocket snapshot and removes the duplicate recent entry", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  const snapshot = snapshotFixture();
  jest.mocked(useOfflineBusinessSnapshots).mockReturnValue({
    ...missingPocket(),
    data: {
      context: {
        sessionGeneration: getAuthSessionGeneration(),
        apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      },
      entries: [{ businessId: 21, status: "available", snapshot }],
      covers: { 21: "file:///cover.jpg" },
    },
  } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  expect(hook.result.current.source).toBe("offline-pocket");
  expect(hook.result.current.localCoverUri).toBe("file:///cover.jpg");
  await recentBusinessDetails.flush();
  expect(await recentBusinessDetails.capture().get(21)).toBeNull();
});

it.each(["missing", "corrupt", "unsupported"])(
  "uses recent detail after a %s Pocket repository read",
  async (status) => {
    await recentBusinessDetails.capture().save(businessFixture(), Date.now());
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue({
      ...missingPocket(status),
      workerStatus: "running",
    } as never);
    const hook = await renderHook(() => useBusinessDetailSource(21));
    await waitFor(() => expect(hook.result.current.source).toBe("recent"));
    expect(hook.result.current.snapshot?.business.business_name).toBe(
      "Sugbo Cafe",
    );
    expect(hook.result.current.snapshot?.business).not.toHaveProperty(
      "is_pocketed",
    );
  },
);

it("uses recent detail if Pocket storage itself fails", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  jest
    .mocked(useOfflineBusinessSnapshots)
    .mockReturnValue({ ownerId: 7, isPending: false, isError: true } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
});

it("keeps recent information visible while a local Pocket read is still pending", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  jest
    .mocked(useOfflineBusinessSnapshots)
    .mockReturnValue({ ownerId: 7, isPending: true, isError: false } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
  expect(hook.result.current.isLoading).toBe(false);
});

it("does not treat pending worker or a live is_pocketed flag as a readable snapshot", async () => {
  const business = businessFixture();
  business.is_pocketed = true;
  await recentBusinessDetails.capture().save(business, Date.now());
  jest
    .mocked(useExploreBusinessProfile)
    .mockReturnValue({ business, isPaused: true, error: null } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
});

it.each(["NOT_FOUND", "PERMISSION_DENIED", "SESSION_EXPIRED"])(
  "never masks an authoritative %s, even with live and Pocket data",
  async (code) => {
    await recentBusinessDetails.capture().save(businessFixture(), Date.now());
    jest.mocked(useExploreBusinessProfile).mockReturnValue({
      business: businessFixture(),
      error: { success: false, code },
    } as never);
    jest.mocked(useOfflineBusinessSnapshots).mockReturnValue({
      ...missingPocket(),
      data: {
        context: {
          sessionGeneration: getAuthSessionGeneration(),
          apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
        },
        entries: [{ status: "available", snapshot: snapshotFixture() }],
      },
    } as never);
    const hook = await renderHook(() => useBusinessDetailSource(21));
    expect(hook.result.current.source).toBe("unavailable");
    expect(hook.result.current.snapshot).toBeNull();
    await recentBusinessDetails.flush();
    expect(await recentBusinessDetails.capture().get(21)).toBeNull();
  },
);

it("does not render expired temporary details when no source exists", async () => {
  expect(
    await recentBusinessDetails
      .capture()
      .save(businessFixture(), Date.now() - RECENT_BUSINESS_LIMITS.maxAgeMs),
  ).toBe(false);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.source).toBe("unavailable");
});

it("keeps data while a fresh detail request is pending, then switches to live", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  onlineManager.setOnline(true);
  jest.mocked(useExploreBusinessProfile).mockReturnValue({
    business: null,
    error: null,
    isLoading: true,
    isFetching: true,
  } as never);
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
  jest.mocked(useExploreBusinessProfile).mockReturnValue({
    business: businessFixture(),
    error: null,
    isLoading: false,
  } as never);
  await hook.rerender({});
  expect(hook.result.current.source).toBe("live");
});

it("drops selected recent data synchronously when the session is revoked", async () => {
  await recentBusinessDetails.capture().save(businessFixture(), Date.now());
  const hook = await renderHook(() => useBusinessDetailSource(21));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
  await act(async () => {
    invalidateAuthSession();
  });
  expect(hook.result.current.source).toBe("unavailable");
  expect(hook.result.current.snapshot).toBeNull();
});
