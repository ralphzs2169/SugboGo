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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
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
