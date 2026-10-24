import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";

import {
  clearSessionTokens,
  saveAccessToken,
  getAccessToken,
  saveRefreshToken,
  saveSessionTokens,
  getRefreshToken,
  clearTokens,
  clearRefreshToken,
  getInstallationId,
} from "../storage.service";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "../authSessionGeneration.service";

/**
 * @file storage.test.ts
 * @description Unit tests for authentication token storage utilities.
 *
 * Verifies that JWT access and refresh tokens are correctly stored,
 * retrieved, and removed using Expo SecureStore wrappers.
 *
 * Run:
 * npm test -- storage.test.ts
 */

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("token storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Case 1: Test saving access token
  it("saves access token", async () => {
    await saveAccessToken("access-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "access_token",
      "access-token",
    );
  });

  // Case 2: Test getting access token
  it("gets access token", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("access-token");

    const result = await getAccessToken();

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("access_token");

    expect(result).toBe("access-token");
  });

  // Case 3: Test saving refresh token
  it("saves refresh token", async () => {
    await saveRefreshToken("refresh-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refresh_token",
      "refresh-token",
    );
  });

  // Case 4: Test getting refresh token
  it("gets refresh token", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("refresh-token");

    const result = await getRefreshToken();

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("refresh_token");

    expect(result).toBe("refresh-token");
  });

  // Case 5: Test clearing tokens
  it("clears access and refresh tokens", async () => {
    await clearTokens();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access_token");

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
  });

  // Case 6: Test clearing only refresh token
  it("clears only refresh token", async () => {
    await clearRefreshToken();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
  });

  it("creates and stores an installation ID when none exists", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (randomUUID as jest.Mock).mockReturnValue("generated-installation");

    await expect(getInstallationId()).resolves.toBe("generated-installation");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "installation_id",
      "generated-installation",
    );
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("reuses the stored installation ID across calls and token clearing", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      "stored-installation",
    );

    await expect(getInstallationId()).resolves.toBe("stored-installation");
    await clearTokens();
    await expect(getInstallationId()).resolves.toBe("stored-installation");

    expect(randomUUID).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "installation_id",
    );
  });

  it("does not invent an ID when SecureStore retrieval fails", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
      new Error("SecureStore unavailable"),
    );

    await expect(getInstallationId()).rejects.toThrow(
      "SecureStore unavailable",
    );
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("rejects when a generated ID cannot be persisted", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (randomUUID as jest.Mock).mockReturnValue("generated-installation");
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(
      new Error("SecureStore unavailable"),
    );

    await expect(getInstallationId()).rejects.toThrow(
      "SecureStore unavailable",
    );
  });

  it("shares concurrent installation initialization until the ID is persisted", async () => {
    const read = createDeferred<string | null>();
    const write = createDeferred<void>();
    const writeStarted = createDeferred<void>();
    (SecureStore.getItemAsync as jest.Mock).mockReturnValue(read.promise);
    (randomUUID as jest.Mock).mockReturnValue("shared-installation");
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(() => {
      writeStarted.resolve();
      return write.promise;
    });

    const first = getInstallationId();
    const second = getInstallationId();
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("installation_id");
    expect(randomUUID).not.toHaveBeenCalled();

    read.resolve(null);
    await writeStarted.promise;
    const third = getInstallationId();
    const settled = jest.fn();
    const results = Promise.all([first, second, third]).then(settled);
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "installation_id",
      "shared-installation",
    );

    write.resolve();
    await results;
    expect(settled).toHaveBeenCalledWith([
      "shared-installation",
      "shared-installation",
      "shared-installation",
    ]);
  });

  it("retries installation initialization after a shared read failure", async () => {
    const read = createDeferred<string | null>();
    const error = new Error("SecureStore read failed");
    (SecureStore.getItemAsync as jest.Mock)
      .mockReturnValueOnce(read.promise)
      .mockResolvedValueOnce("stored-after-retry");

    const results = Promise.allSettled([
      getInstallationId(),
      getInstallationId(),
    ]);
    read.reject(error);
    await expect(results).resolves.toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
    expect(randomUUID).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();

    await expect(getInstallationId()).resolves.toBe("stored-after-retry");
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2);
  });

  it("retries installation initialization without caching an unpersisted ID", async () => {
    const write = createDeferred<void>();
    const writeStarted = createDeferred<void>();
    const error = new Error("SecureStore write failed");
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (randomUUID as jest.Mock)
      .mockReturnValueOnce("unpersisted-installation")
      .mockReturnValueOnce("persisted-installation");
    (SecureStore.setItemAsync as jest.Mock)
      .mockImplementationOnce(() => {
        writeStarted.resolve();
        return write.promise;
      })
      .mockResolvedValueOnce(undefined);

    const first = getInstallationId();
    await writeStarted.promise;
    const results = Promise.allSettled([first, getInstallationId()]);
    write.reject(error);
    await expect(results).resolves.toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);

    await expect(getInstallationId()).resolves.toBe("persisted-installation");
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(2);
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      2,
      "installation_id",
      "persisted-installation",
    );
  });

  it("lets logout cleanup win when a session changes during token persistence", async () => {
    const accountAGeneration = beginAuthSession();
    const accessWrite = createDeferred<void>();
    const accessWriteStarted = createDeferred<void>();

    (SecureStore.setItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === "access_token") {
        accessWriteStarted.resolve();
        return accessWrite.promise;
      }

      return Promise.resolve();
    });

    const accountAWrite = saveSessionTokens(
      "account-a-access",
      "account-a-refresh",
      accountAGeneration,
    );
    await accessWriteStarted.promise;

    const logoutGeneration = invalidateAuthSession();
    const logoutCleanup = clearSessionTokens(logoutGeneration);
    accessWrite.resolve();

    await expect(accountAWrite).resolves.toBe(false);
    await expect(logoutCleanup).resolves.toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
      "refresh_token",
      "account-a-refresh",
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh_token");
  });

  it("serializes account replacement so Account B credentials finish last", async () => {
    const accountAGeneration = beginAuthSession();
    const accountAAccessWrite = createDeferred<void>();
    const accountAWriteStarted = createDeferred<void>();

    (SecureStore.setItemAsync as jest.Mock).mockImplementation((key, value) => {
      if (key === "access_token" && value === "account-a-access") {
        accountAWriteStarted.resolve();
        return accountAAccessWrite.promise;
      }

      return Promise.resolve();
    });

    const accountAWrite = saveSessionTokens(
      "account-a-access",
      "account-a-refresh",
      accountAGeneration,
    );
    await accountAWriteStarted.promise;

    const accountBGeneration = beginAuthSession();
    const accountBWrite = saveSessionTokens(
      "account-b-access",
      "account-b-refresh",
      accountBGeneration,
    );
    accountAAccessWrite.resolve();

    await expect(accountAWrite).resolves.toBe(false);
    await expect(accountBWrite).resolves.toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
      "refresh_token",
      "account-a-refresh",
    );
    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      2,
      "access_token",
      "account-b-access",
    );
    expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
      3,
      "refresh_token",
      "account-b-refresh",
    );
  });

  it("revokes offline access with guarded token cleanup", async () => {
    useOfflineAccessStore.setState({ ownerId: 7, isRevoking: false });
    const generation = invalidateAuthSession();
    const cleanup = clearSessionTokens(generation);
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(useOfflineAccessStore.getState().isRevoking).toBe(true);
    await expect(cleanup).resolves.toBe(true);
  });

  it("does not revoke newer offline access for stale cleanup", async () => {
    const generation = invalidateAuthSession();
    beginAuthSession();
    useOfflineAccessStore.setState({ ownerId: 8, isRevoking: false });
    await expect(clearSessionTokens(generation)).resolves.toBe(false);
    expect(useOfflineAccessStore.getState().ownerId).toBe(8);
    expect(useOfflineAccessStore.getState().isRevoking).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("does not let delayed logout cleanup delete a newer login", async () => {
    beginAuthSession();
    const logoutGeneration = invalidateAuthSession();
    const accessDelete = createDeferred<void>();
    const accessDeleteStarted = createDeferred<void>();

    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === "access_token") {
        accessDeleteStarted.resolve();
        return accessDelete.promise;
      }

      return Promise.resolve();
    });

    const logoutCleanup = clearSessionTokens(logoutGeneration);
    await accessDeleteStarted.promise;

    const accountBGeneration = beginAuthSession();
    const accountBWrite = saveSessionTokens(
      "account-b-access",
      "account-b-refresh",
      accountBGeneration,
    );
    accessDelete.resolve();

    await expect(logoutCleanup).resolves.toBe(false);
    await expect(accountBWrite).resolves.toBe(true);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "refresh_token",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "access_token",
      "account-b-access",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refresh_token",
      "account-b-refresh",
    );
  });
});
