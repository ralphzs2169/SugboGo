import { clearOfflineAccess } from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { AuthResponse } from "@/features/auth/types/auth.types";
import { StaleAuthSessionError } from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  saveSessionTokens,
} from "@/shared/api/storage.service";
import { queryClient } from "@/shared/query/queryClient";

import { establishSession } from "../authSession";

jest.mock("@/shared/api/storage.service", () => ({
  clearSessionTokens: jest.fn(),
  saveSessionTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(),
  rememberOfflineResources: jest.fn().mockResolvedValue(undefined),
}));

const mockedClearSessionTokens = jest.mocked(clearSessionTokens);
const mockedSaveSessionTokens = jest.mocked(saveSessionTokens);

const explorerSession: AuthResponse = {
  access: "explorer-access",
  refresh: "explorer-refresh",
  user: {
    id: 1,
    first_name: "Explorer",
    last_name: "Account",
    gender: null,
    email: "explorer@example.com",
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  },
};

const merchantSession: AuthResponse = {
  access: "merchant-access",
  refresh: "merchant-refresh",
  user: {
    ...explorerSession.user,
    id: 2,
    first_name: "Merchant",
    email: "merchant@example.com",
    role: "merchant",
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("establishSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useAppModeStore.setState({ activeMode: "merchant" });
    jest.mocked(clearOfflineAccess).mockResolvedValue(undefined);
    useOfflineAccessStore.setState({ ownerId: 9, isRevoking: true });
    mockedSaveSessionTokens.mockResolvedValue(true);
    mockedClearSessionTokens.mockResolvedValue(true);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("persists credentials, authenticates the user, and starts in Explorer mode", async () => {
    await establishSession(explorerSession);

    expect(mockedSaveSessionTokens).toHaveBeenCalledWith(
      "explorer-access",
      "explorer-refresh",
      expect.any(Number),
    );
    expect(clearOfflineAccess).toHaveBeenCalledTimes(1);
    expect(useOfflineAccessStore.getState().isRevoking).toBe(false);
    expect(useAuthStore.getState().user).toEqual(explorerSession.user);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  });

  it("does not let an older login replace a newer account", async () => {
    const accountAWrite = createDeferred<boolean>();
    const accountBWrite = createDeferred<boolean>();
    mockedSaveSessionTokens.mockImplementation((accessToken) =>
      accessToken === "explorer-access"
        ? accountAWrite.promise
        : accountBWrite.promise,
    );

    const accountALogin = establishSession(explorerSession);
    const accountBLogin = establishSession(merchantSession);

    accountBWrite.resolve(true);
    await expect(accountBLogin).resolves.toBeUndefined();
    accountAWrite.resolve(true);

    await expect(accountALogin).rejects.toBeInstanceOf(StaleAuthSessionError);
    expect(useAuthStore.getState().user).toEqual(merchantSession.user);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  });

  it("clears account-scoped caches when replacing an account", async () => {
    queryClient.setQueryData(["notifications", 1], { unread: 3 });
    await establishSession(merchantSession);
    expect(queryClient.getQueryData(["notifications", 1])).toBeUndefined();
  });

  it("revokes the failed session if offline access cleanup fails", async () => {
    jest
      .mocked(clearOfflineAccess)
      .mockRejectedValueOnce(new Error("storage failed"));
    await expect(establishSession(explorerSession)).rejects.toThrow(
      "storage failed",
    );
    expect(mockedSaveSessionTokens).not.toHaveBeenCalled();
    expect(mockedClearSessionTokens).toHaveBeenCalledWith(expect.any(Number));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("still allows an eligible Merchant to switch modes after login", async () => {
    await establishSession(merchantSession);

    useAppModeStore.getState().setActiveMode("merchant");

    expect(useAuthStore.getState().user?.role).toBe("merchant");
    expect(useAppModeStore.getState().activeMode).toBe("merchant");
  });
});
