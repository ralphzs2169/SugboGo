import * as SecureStore from "expo-secure-store";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  OFFLINE_API_SCOPE,
  OFFLINE_OWNER_KEY,
} from "../../constants/offlineRoutes.constants";
import { useOfflineAccessStore } from "../../stores/offlineAccess.store";
import {
  clearOfflineAccess,
  getOfflineOwner,
  rememberOfflineOwner,
} from "../offlineAccess.service";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("device-only owner access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
