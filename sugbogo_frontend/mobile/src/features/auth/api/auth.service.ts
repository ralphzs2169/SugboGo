import apiClient from "@/shared/api/apiClient";
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
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
 * @returns {Promise<AuthResponse >} The authenticated user and JWT tokens.
 * @throws {AxiosError} If the login request fails or the credentials are invalid.
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
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

/**
 * Registers a new user.
 *
 * Sends the user's registration information to the backend and returns
 * the authenticated user together with the issued JWT access and refresh tokens.
 *
 * @param {RegisterRequest} data - The user's registration information.
 * @returns {Promise<AuthResponse>} The authenticated user and JWT tokens.
 * @throws {AxiosError} If the registration request fails or validation errors occur.
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register/", data);

  return response.data;
}

/**
 * Resends the email verification link to the user's email address.
 * @param {string} email - The user's email address.
 * @returns {Promise<any>} The response from the backend.
 * @throws {AxiosError} If the request fails or the email is invalid.
 */
export async function resendVerification(email: string) {
  const response = await apiClient.post("/auth/resend-verification/", {
    email,
  });

  return response.data;
}
