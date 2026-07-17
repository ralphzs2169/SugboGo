import {
  getCurrentUser,
  login,
  refreshAccessToken,
  register,
  resendVerification,
} from "../auth.service";

import apiClient from "@/shared/api/apiClient";

/**
 * @file auth.service.test.ts
 * @description Unit tests for authentication API service functions.
 *
 * Verifies that authentication requests correctly communicate with
 * the backend API, including login, registration, current user retrieval,
 * token refresh, and email verification resend requests.
 *
 * Run:
 * npm test -- auth.service.test.ts
 */

jest.mock("@/shared/api/apiClient", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Case 1: Test the login function
  it("login sends credentials", async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        access: "access-token",
        refresh: "refresh-token",
      },
    });

    const result = await login({
      email: "test@test.com",
      password: "password123",
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith("/auth/login/", {
      email: "test@test.com",
      password: "password123",
    });

    expect(result).toEqual({
      access: "access-token",
      refresh: "refresh-token",
    });
  });

  // Case 2: Test the register function
  it("register sends registration data", async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        message: "Registration successful",
      },
    });

    const result = await register({
      email: "new@test.com",
      password: "Password123!",
      first_name: "John",
      last_name: "Doe",
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith("/auth/register/", {
      email: "new@test.com",
      password: "Password123!",
      first_name: "John",
      last_name: "Doe",
    });

    expect(result).toEqual({
      message: "Registration successful",
    });
  });

  // Case 3: Test the refreshAccessToken function
  it("refreshAccessToken sends refresh token", async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        access: "new-access-token",
      },
    });

    const result = await refreshAccessToken("refresh-token");

    expect(mockedApiClient.post).toHaveBeenCalledWith("/auth/refresh/", {
      refresh: "refresh-token",
    });

    expect(result).toEqual({
      access: "new-access-token",
    });
  });

  // Case 4: Test the getCurrentUser function
  it("getCurrentUser requests current user", async () => {
    mockedApiClient.get.mockResolvedValue({
      data: {
        email: "test@test.com",
        role: "explorer",
      },
    });

    const result = await getCurrentUser();

    expect(mockedApiClient.get).toHaveBeenCalledWith("/users/me/");

    expect(result).toEqual({
      email: "test@test.com",
      role: "explorer",
    });
  });

  // Case 5: Test the resendVerification function
  it("resendVerification sends email", async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        message: "Verification email sent",
      },
    });

    const result = await resendVerification("test@test.com");

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      "/auth/resend-verification/",
      {
        email: "test@test.com",
      },
    );

    expect(result).toEqual({
      message: "Verification email sent",
    });
  });
});
