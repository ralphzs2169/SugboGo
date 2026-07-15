import apiClient from "@/shared/api/apiClient";
import {
  LoginRequest,
  LoginResponse,
  User,
  RefreshResponse,
} from "./auth.types";

/**
 * Authenticates a user with the backend.
 *
 * Sends the user's email and password to the login endpoint and returns
 * the authenticated user's information along with the JWT access and
 * refresh tokens upon successful authentication.
 *
 * @param {LoginRequest} credentials - The user's login credentials.
 * @returns {Promise<LoginResponse>} The authenticated user and JWT tokens.
 * @throws {AxiosError} If the login request fails or the credentials are invalid.
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login/",
    credentials,
  );

  return response.data;
}

/**
 * Retrieves the currently authenticated user's information.
 *
 * Sends a request to the backend using the current JWT access token.
 * This endpoint is primarily used to restore the user's session when
 * the application starts.
 *
 * @returns {Promise<User>} The authenticated user's information.
 * @throws {AxiosError} If the access token is invalid, expired, or missing.
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>("/users/me/");

  return response.data;
}

/**
 * Requests a new access token using the stored refresh token.
 *
 * @param refreshToken - The user's refresh token.
 * @returns A new access token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>("/auth/refresh/", {
    refresh: refreshToken,
  });

  return response.data;
}
