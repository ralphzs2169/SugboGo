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
  has_completed_interest_selection: boolean;
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
 * during user login.
 *
 * Field names follow the backend response format.
 */
export interface LoginFieldErrors {
  email?: string[];
  password?: string[];
  detail?: string;
  code?: string;
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

/**
 * Represents the result of an authentication request.
 *
 * A successful request contains authentication data.
 * A failed request contains structured validation errors.
 */
export interface AuthResult<TError = Record<string, string[]>> {
  success: boolean;
  errors?: TError;
  data?: AuthResponse;
}
