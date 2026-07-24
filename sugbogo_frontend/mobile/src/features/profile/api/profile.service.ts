import apiClient from "@/shared/api/apiClient";
import { User } from "@/features/auth/api/auth.types";
import {
  UpdateProfilePictureResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateAvatarPreferenceRequest,
  UpdateAvatarPreferenceResponse,
} from "./profile.types";
import { ApiResponse } from "@/shared/api/types";
import { request } from "@/shared/api/request";

export async function getProfile(): Promise<User> {
  const response = await apiClient.get<User>("/users/me/");

  return response.data;
}

export function updateProfile(data: UpdateProfileRequest) {
  return request<ApiResponse<UpdateProfileResponse>>(
    apiClient.patch<ApiResponse<UpdateProfileResponse>>("/users/me/", data),
  );
}

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

export function removeProfilePicture() {
  return request<ApiResponse<User>>(
    apiClient.delete<ApiResponse<User>>("/users/me/profile-picture/"),
  );
}

export function updateAvatarPreference(data: UpdateAvatarPreferenceRequest) {
  return request<ApiResponse<UpdateAvatarPreferenceResponse>>(
    apiClient.patch<ApiResponse<UpdateAvatarPreferenceResponse>>(
      "/users/me/avatar-preferences/",
      data,
    ),
  );
}
