import { refreshSession } from "../refresh";

import { getRefreshToken, saveAccessToken, saveRefreshToken } from "../storage";

import { refreshAccessToken } from "@/features/auth/api/token.service";

/**
 * @file refresh.test.ts
 * @description Unit tests for authentication session refresh utilities.
 *
 * Verifies that refreshSession correctly retrieves the stored refresh token,
 * requests new JWT tokens, updates token storage, and handles missing
 * refresh tokens.
 *
 * Run:
 * npm test -- refresh.test.ts
 */

jest.mock("../storage", () => ({
  getRefreshToken: jest.fn(),
  saveAccessToken: jest.fn(),
  saveRefreshToken: jest.fn(),
}));

jest.mock("@/features/auth/api/token.service", () => ({
  refreshAccessToken: jest.fn(),
}));

const mockedGetRefreshToken = getRefreshToken as jest.Mock;

const mockedSaveAccessToken = saveAccessToken as jest.Mock;

const mockedSaveRefreshToken = saveRefreshToken as jest.Mock;

const mockedRefreshAccessToken = refreshAccessToken as jest.Mock;

describe("refreshSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refreshes session and saves new tokens", async () => {
    mockedGetRefreshToken.mockResolvedValue("old-refresh-token");

    mockedRefreshAccessToken.mockResolvedValue({
      access: "new-access-token",
      refresh: "new-refresh-token",
    });

    const result = await refreshSession();

    expect(mockedRefreshAccessToken).toHaveBeenCalledWith("old-refresh-token");

    expect(mockedSaveAccessToken).toHaveBeenCalledWith("new-access-token");

    expect(mockedSaveRefreshToken).toHaveBeenCalledWith("new-refresh-token");

    expect(result).toBe("new-access-token");
  });

  it("does not save refresh token when backend does not rotate it", async () => {
    mockedGetRefreshToken.mockResolvedValue("old-refresh-token");

    mockedRefreshAccessToken.mockResolvedValue({
      access: "new-access-token",
    });

    const result = await refreshSession();

    expect(mockedSaveAccessToken).toHaveBeenCalledWith("new-access-token");

    expect(mockedSaveRefreshToken).not.toHaveBeenCalled();

    expect(result).toBe("new-access-token");
  });

  it("throws error when refresh token is missing", async () => {
    mockedGetRefreshToken.mockResolvedValue(null);

    await expect(refreshSession()).rejects.toThrow(
      "No refresh token available",
    );

    expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
  });
});
