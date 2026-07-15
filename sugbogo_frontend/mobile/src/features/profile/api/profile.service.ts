import apiClient from "@/shared/api/apiClient";
import { User } from "@/features/auth/api/auth.types";

/**
 * Retrieves the authenticated user's profile.
 *
 * Sends a request to the backend using the stored JWT access token.
 *
 * @returns {Promise<User>} The authenticated user's profile.
 */
export async function getProfile(): Promise<User> {
  const response = await apiClient.get<User>("/users/me/");

  return response.data;
}
