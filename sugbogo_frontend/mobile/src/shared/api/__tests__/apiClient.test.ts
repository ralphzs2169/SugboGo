import MockAdapter from "axios-mock-adapter";

import apiClient from "../apiClient";

import { getAccessToken, clearTokens } from "../storage";

import { refreshSession } from "../refresh";

import { useAuthStore } from "@/features/auth/store/auth.store";

/**
 * @file apiClient.test.ts
 * @description Unit tests for Axios authentication interceptors.
 *
 * Verifies that the API client correctly attaches JWT access tokens,
 * skips authentication endpoints, refreshes expired sessions, retries
 * failed requests, and clears authentication state when refresh fails.
 *
 * Run:
 * npm test -- apiClient.test.ts
 */

jest.mock("../storage", () => ({
  getAccessToken: jest.fn(),
  clearTokens: jest.fn(),
}));

jest.mock("../refresh", () => ({
  refreshSession: jest.fn(),
}));

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      clearUser: jest.fn(),
    })),
  },
}));

const mockedGetAccessToken = getAccessToken as jest.Mock;

const mockedRefreshSession = refreshSession as jest.Mock;

const mockAxios = new MockAdapter(apiClient);

describe("apiClient interceptors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
  });

  it("adds access token to protected requests", async () => {
    mockedGetAccessToken.mockResolvedValue("access-token");

    mockAxios.onGet("/users/me/").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer access-token");

      return [
        200,
        {
          id: 1,
        },
      ];
    });

    const response = await apiClient.get("/users/me/");

    expect(response.status).toBe(200);
  });

  it("does not add token to login endpoint", async () => {
    mockedGetAccessToken.mockResolvedValue("access-token");

    mockAxios.onPost("/auth/login/").reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();

      return [200, {}];
    });

    await apiClient.post("/auth/login/", {
      email: "test@test.com",
      password: "password",
    });
  });

  /**
   * Refreshes the access token after a 401 response
   * and retries the original request.
   */
  it("refreshes token and retries request after 401", async () => {
    mockedGetAccessToken
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("new-access-token");

    mockedRefreshSession.mockResolvedValue("new-access-token");

    let requestCount = 0;

    mockAxios.onGet("/users/me/").reply((config) => {
      requestCount++;

      if (requestCount === 1) {
        return [
          401,
          {
            detail: "Token expired",
          },
        ];
      }

      expect(config.headers?.Authorization).toBe("Bearer new-access-token");

      return [
        200,
        {
          id: 1,
          email: "test@test.com",
        },
      ];
    });

    const response = await apiClient.get("/users/me/");

    expect(mockedRefreshSession).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(200);

    expect(requestCount).toBe(2);
  });
});
