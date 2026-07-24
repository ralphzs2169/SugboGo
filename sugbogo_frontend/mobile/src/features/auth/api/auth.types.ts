/**
 * Request payload sent to the authentication API when a user logs in.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Registration request payload.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

/**
 * Represents the authenticated user's basic profile information
 * returned by the authentication API.
 */
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say" | null;
  avatar_url?: string | null;
  email: string;
  role: string;
  status: string;
  has_completed_interest_selection: boolean;
  has_custom_profile_picture: boolean;
  use_oauth_avatar: boolean;
}

/**
 * Response returned by the authentication API after a successful login.
 * Includes the authenticated user information along with JWT access and
 * refresh tokens.
 */
export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

/**
 * Response returned when refreshing JWT tokens.
 */
export interface RefreshResponse {
  access: string;
  refresh?: string;
}

/**
 * Represents validation errors returned by the backend
 * during user registration.
 *
 * Field names follow the backend serializer naming convention.
 */
export interface RegisterFieldErrors {
  first_name?: string[];
  last_name?: string[];
  email?: string[];
  password?: string[];
  detail?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  uid: string;
  token: string;
  password: string;
}
