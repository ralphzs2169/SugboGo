import apiClient from "@/shared/api/apiClient";
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  RefreshResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "./auth.types";
import { ApiSuccessWithData, ApiSuccess } from "@/shared/api/types";

/**
 * Authenticates a user with the backend.
 *
 * Sends the user's email and password to the login endpoint and returns
 * the authenticated user's information along with the JWT access and
 * refresh tokens upon successful authentication.
 *
 * @param {LoginRequest} credentials - The user's login credentials.
 * @returns {Promise<ApiSuccessWithData<AuthResponse>>} The authenticated user's information and JWT tokens.
 *
 */
export async function login(
  credentials: LoginRequest,
): Promise<ApiSuccessWithData<AuthResponse>> {
  const response = await apiClient.post<ApiSuccessWithData<AuthResponse>>(
    "/auth/login/",
    credentials,
  );

  return response.data;
}

export async function googleLogin(
  idToken: string,
): Promise<ApiSuccessWithData<AuthResponse>> {
  const response = await apiClient.post<ApiSuccessWithData<AuthResponse>>(
    "/auth/google-login/",
    {
      id_token: idToken,
    },
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
  const response = await apiClient.get<ApiSuccess<User>>("/users/me/");

  return response.data.data!;
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
 * @returns {Promise<ApiSuccessWithData<AuthResponse>>} The authenticated user and JWT tokens.
 * @throws {AxiosError} If the registration request fails or validation errors occur.
 */
export async function register(
  data: RegisterRequest,
): Promise<ApiSuccess<AuthResponse>> {
  const response = await apiClient.post<ApiSuccess<AuthResponse>>(
    "/auth/register/",
    data,
  );

  return response.data;
}

/**
 * Resends the email verification link to the user's email address.
 * @param {string} email - The user's email address.
 * @returns {Promise<ApiSuccess>} The response from the backend.
 */
export async function resendVerification(email: string): Promise<ApiSuccess> {
  const response = await apiClient.post<ApiSuccess>(
    "/auth/resend-verification/",
    {
      email,
    },
  );

  return response.data;
}

/**
 * Sends a password reset email.
 *
 * @param {ForgotPasswordRequest} data - The user's email address.
 * @returns {Promise<ApiSuccess>} Backend response.
 */
export async function forgotPassword(
  data: ForgotPasswordRequest,
): Promise<ApiSuccess> {
  const response = await apiClient.post<ApiSuccess>(
    "/auth/forgot-password/",
    data,
  );

  return response.data;
}

/**
 * Resets a user's password using a valid reset token.
 *
 * @param data - Password reset request payload.
 * @returns Backend response.
 */
export async function resetPassword(
  data: ResetPasswordRequest,
): Promise<ApiSuccess> {
  const response = await apiClient.post<ApiSuccess>(
    "/auth/reset-password/",
    data,
  );

  return response.data;
}
