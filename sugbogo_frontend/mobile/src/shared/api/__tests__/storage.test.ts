import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";

import {
  saveAccessToken,
  getAccessToken,
  saveRefreshToken,
  getRefreshToken,
  clearTokens,
  clearRefreshToken,
  getInstallationId,
} from "../storage.service";

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
});
