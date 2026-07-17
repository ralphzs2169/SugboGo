import { refreshAccessToken } from "../token.service";

import apiClient from "@/shared/api/authClient";

/**
 * @file token.service.test.ts
 * @description Unit tests for token refresh API functions.
 *
 * Verifies:
 * - refreshAccessToken sends the refresh token
 * - refreshAccessToken returns backend response
 *
 * Run:
 * npm test -- token.service.test.ts
 */

jest.mock("@/shared/api/authClient", () => ({
  post: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe("token.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requests a new access token using refresh token", async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        access: "new-access-token",
        refresh: "new-refresh-token",
      },
    });

    const result = await refreshAccessToken("old-refresh-token");

    expect(mockedApiClient.post).toHaveBeenCalledWith("/auth/refresh/", {
      refresh: "old-refresh-token",
    });

    expect(result).toEqual({
      access: "new-access-token",
      refresh: "new-refresh-token",
    });
  });
});
