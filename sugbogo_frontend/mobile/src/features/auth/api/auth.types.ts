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
  email: string;
  role: string;
  status: string;
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

export interface RegisterFieldErrors {
  first_name?: string[];
  last_name?: string[];
  email?: string[];
  password?: string[];
}

export interface RegisterResult {
  success: boolean;
  errors?: RegisterFieldErrors;
  data?: AuthResponse;
}
