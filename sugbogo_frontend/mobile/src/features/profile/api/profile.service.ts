import apiClient from "@/shared/api/apiClient.service";
import { User } from "@/features/users/types/user.types";
import {
  UpdateProfilePictureResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateAvatarPreferenceRequest,
  UpdateAvatarPreferenceResponse,
} from "../types/profile.types";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { request } from "@/shared/api/request.service";

export function getProfile(): Promise<ApiResponse<User>> {
  return request<ApiResponse<User>>(
    apiClient.get<ApiResponse<User>>("/users/me/"),
  );
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
