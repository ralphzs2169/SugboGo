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
import { ApiMessageResponse, ApiResponse } from "@/shared/api/types";
import { request } from "@/shared/api/request";

/**
 * Authenticates a user with the backend.
 *
 * Sends the user's email and password to the login endpoint and returns
 * the authenticated user's information along with the JWT access and
 * refresh tokens upon successful authentication.
 *
 * @param {LoginRequest} credentials - The user's login credentials.
 * @returns {Promise<ApiResponse<AuthResponse>>} The authenticated user's information and JWT tokens.
 *
 */
export async function login(
  credentials: LoginRequest,
): Promise<ApiResponse<AuthResponse>> {
  return request(
    apiClient.post<ApiResponse<AuthResponse>>("/auth/login/", credentials),
  );
}

export function googleLogin(
  idToken: string,
): Promise<ApiResponse<AuthResponse>> {
  return request(
    apiClient.post<ApiResponse<AuthResponse>>("/auth/google-login/", {
      id_token: idToken,
    }),
  );
}

/**
 * Authenticates a user with the backend using a Facebook access token.
 *
 * Sends the user's Facebook access token to the login endpoint and returns
 * the authenticated user's information along with the JWT access and
 * refresh tokens upon successful authentication.
 *
 * @param {string} accessToken - The user's Facebook access token.
 * @returns {Promise<ApiMessageResponse>} The authenticated user's information and JWT tokens.
 */
export function facebookLogin(
  accessToken: string,
): Promise<ApiResponse<AuthResponse>> {
  return request(
    apiClient.post<ApiResponse<AuthResponse>>("/auth/facebook-login/", {
      access_token: accessToken,
    }),
  );
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
  const response = await apiClient.get<ApiResponse<User>>("/users/me/");

  if (!response.data.success) {
    throw new Error(response.data.message);
  }

  return response.data.data;
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
 * @returns {Promise<ApiMessageResponse>} The authenticated user and JWT tokens.
 * @throws {AxiosError} If the registration request fails or validation errors occur.
 */
export function register(
  data: RegisterRequest,
): Promise<ApiResponse<AuthResponse>> {
  return request(
    apiClient.post<ApiResponse<AuthResponse>>("/auth/register/", data),
  );
}

/**
 * Verifies a user's email using the uid and token from the email link.
 *
 * @param uid - Base64 encoded user id.
 * @param token - Django verification token.
 * @returns Backend response.
 */
export function verifyEmail(
  uid: string,
  token: string,
): Promise<ApiMessageResponse> {
  return request(
    apiClient.get<ApiMessageResponse>("/auth/verify-email/", {
      params: {
        uid,
        token,
      },
    }),
  );
}

/**
 * Resends the email verification link to the user's email address.
 * @param {string} email - The user's email address.
 * @returns {Promise<ApiMessageResponse>} The response from the backend.
 */
export function resendVerification(email: string): Promise<ApiMessageResponse> {
  return request(
    apiClient.post<ApiMessageResponse>("/auth/resend-verification/", {
      email,
    }),
  );
}

/**
 * Sends a password reset email.
 *
 * @param {ForgotPasswordRequest} data - The user's email address.
 * @returns {Promise<ApiMessageResponse>} Backend response.
 */
export function forgotPassword(
  data: ForgotPasswordRequest,
): Promise<ApiMessageResponse> {
  return request(
    apiClient.post<ApiMessageResponse>("/auth/forgot-password/", data),
  );
}

/**
 * Resets a user's password using a valid reset token.
 *
 * @param data - Password reset request payload.
 * @returns Backend response.
 */
export function resetPassword(
  data: ResetPasswordRequest,
): Promise<ApiMessageResponse> {
  return request(
    apiClient.post<ApiMessageResponse>("/auth/reset-password/", data),
  );
}
