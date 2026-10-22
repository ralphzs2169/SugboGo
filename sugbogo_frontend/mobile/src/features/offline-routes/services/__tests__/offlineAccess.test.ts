import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import {
  OFFLINE_API_SCOPE,
  OFFLINE_OWNER_KEY,
} from "../../constants/offlineRoutes.constants";
import { useOfflineAccessStore } from "../../stores/offlineAccess.store";
import {
  clearOfflineAccess,
  getOfflineOwner,
  rememberOfflineOwner,
  getRestorableOfflineOwner,
  releaseOfflineAccessIfEmpty,
  rememberOfflineResources,
} from "../offlineAccess.service";

const mockHasJourneys = jest.fn();
const mockHasBusinesses = jest.fn();
jest.mock("../savedJourneys.service", () => ({
  hasSavedJourneysForOfflineAccess: (...args: unknown[]) =>
    mockHasJourneys(...args),
}));
jest.mock("@/features/offline-pockets/services/offlinePockets.service", () => ({
  hasBusinessSnapshotsForOfflineAccess: (...args: unknown[]) =>
    mockHasBusinesses(...args),
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("device-only owner access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasJourneys.mockReset().mockResolvedValue(false);
    mockHasBusinesses.mockReset().mockResolvedValue(false);
    beginAuthSession();
    useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
    useOfflineAccessStore.setState({ ownerId: null, isRevoking: false });
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it("stores only an owner and environment marker, without a token or profile", async () => {
    await rememberOfflineOwner(7);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      OFFLINE_OWNER_KEY,
      JSON.stringify({ version: 1, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
    );
  });

  it("restores business-only local access after an offline restart, without authentication", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ version: 1, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
      );
    mockHasBusinesses.mockResolvedValue(true);
    await expect(
      getRestorableOfflineOwner(getAuthSessionGeneration()),
    ).resolves.toBe(7);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockHasBusinesses).toHaveBeenCalledWith(
      7,
      getAuthSessionGeneration(),
    );
  });

  it("does not restore a marker when neither resource is usable", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ version: 1, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
      );
    await expect(
      getRestorableOfflineOwner(getAuthSessionGeneration()),
    ).resolves.toBeNull();
  });

  it("preserves access to journeys when businesses are cleared, then revokes the final empty grant", async () => {
    useOfflineAccessStore.setState({ ownerId: 7 });
    mockHasJourneys.mockResolvedValueOnce(true);
    await releaseOfflineAccessIfEmpty(7, getAuthSessionGeneration());
    expect(useOfflineAccessStore.getState().ownerId).toBe(7);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    await releaseOfflineAccessIfEmpty(7, getAuthSessionGeneration());
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(useOfflineAccessStore.getState().isRevoking).toBe(false);
  });

  it("keeps a usable resource if the other database fails, and fails closed when availability is unknown", async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ version: 1, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
      );
    mockHasJourneys.mockRejectedValue(new Error("database unavailable"));
    mockHasBusinesses.mockResolvedValueOnce(true);
    await expect(
      getRestorableOfflineOwner(getAuthSessionGeneration()),
    ).resolves.toBe(7);
    await expect(
      getRestorableOfflineOwner(getAuthSessionGeneration()),
    ).rejects.toThrow("Unable to verify");
    await expect(
      releaseOfflineAccessIfEmpty(7, getAuthSessionGeneration()),
    ).rejects.toThrow();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("cannot restore a previous account or ended session and re-registers retained data only after sign-in", async () => {
    mockHasBusinesses.mockResolvedValue(true);
    const generation = getAuthSessionGeneration();
    await rememberOfflineResources(7, generation);
    useAuthStore.setState({ user: { id: 8 } as never });
    await expect(releaseOfflineAccessIfEmpty(7, generation)).rejects.toThrow();
    beginAuthSession();
    await expect(rememberOfflineResources(8, generation)).rejects.toThrow();
    await clearOfflineAccess();
    await expect(
      getRestorableOfflineOwner(getAuthSessionGeneration()),
    ).rejects.toThrow();
  });

  it("rejects another owner and unauthenticated saves", async () => {
    await expect(rememberOfflineOwner(8)).rejects.toThrow("Sign in");
    useAuthStore.setState({ isAuthenticated: false });
    await expect(rememberOfflineOwner(7)).rejects.toThrow("Sign in");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it.each([
    "broken",
    "null",
    JSON.stringify({ version: 2, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
    JSON.stringify({ version: 1, ownerId: 7, apiScope: "another-environment" }),
    JSON.stringify({ version: 1, ownerId: -1, apiScope: OFFLINE_API_SCOPE }),
  ])("rejects corrupt or mismatched markers", async (value) => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(value);
    await expect(getOfflineOwner()).resolves.toBeNull();
  });

  it("reads local ownership without establishing authentication", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ version: 1, ownerId: 7, apiScope: OFFLINE_API_SCOPE }),
    );
    await expect(getOfflineOwner()).resolves.toBe(7);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("revokes a marker even when its earlier save is still in flight", async () => {
    let finishSave!: () => void;
    let started!: () => void;
    const saveStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    (SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(() => {
      started();
      return new Promise<void>((resolve) => {
        finishSave = resolve;
      });
    });
    const saving = rememberOfflineOwner(7);
    await saveStarted;
    useOfflineAccessStore.setState({ ownerId: 7 });
    const revoking = clearOfflineAccess();
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    finishSave();
    await Promise.all([saving, revoking]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(OFFLINE_OWNER_KEY);
    await expect(rememberOfflineOwner(7)).rejects.toThrow("Sign in");
  });

  it("rejects a queued marker from the previous session after the same user signs in", async () => {
    let release!: () => void;
    let started!: () => void;
    const deleting = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementationOnce(() => {
      started();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const clearing = clearOfflineAccess();
    await deleting;
    const staleMarker = rememberOfflineOwner(7).catch(
      (error: unknown) => error,
    );
    beginAuthSession();
    useOfflineAccessStore.setState({ isRevoking: false });
    const newMarker = rememberOfflineOwner(7);
    release();
    await clearing;
    expect(await staleMarker).toEqual(expect.any(Error));
    await newMarker;
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });
});
