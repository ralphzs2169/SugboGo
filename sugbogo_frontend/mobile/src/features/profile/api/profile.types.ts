import { User } from "@/features/auth/api/auth.types";

export type UpdateProfilePictureResponse = User;

export type UpdateProfileRequest = {
  first_name: string;
  last_name: string;
};

export type UpdateProfileResponse = User;

export type UpdateAvatarPreferenceRequest = {
  use_oauth_avatar: boolean;
};
export type UpdateAvatarPreferenceResponse = User;
