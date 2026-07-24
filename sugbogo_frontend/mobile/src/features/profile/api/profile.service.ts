import apiClient from "@/shared/api/apiClient";
import { User } from "@/features/auth/api/auth.types";
import {
  UpdateProfilePictureResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "./profile.types";
import { ApiResponse } from "@/shared/api/types";
import { request } from "@/shared/api/request";

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

/**
 * Uploads a new profile picture.
 */
export function updateProfilePicture(
  formData: FormData,
): Promise<ApiResponse<UpdateProfilePictureResponse>> {
  return request(
    apiClient.patch<ApiResponse<UpdateProfilePictureResponse>>(
      "/users/me/profile-picture/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    ),
  );
}

export function updateProfile(data: UpdateProfileRequest) {
  return request<ApiResponse<UpdateProfileResponse>>(
    apiClient.patch<ApiResponse<UpdateProfileResponse>>("/users/me/", data),
  );
}
