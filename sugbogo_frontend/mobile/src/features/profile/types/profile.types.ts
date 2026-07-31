import { User } from "@/features/users/types/user.types";

export type UpdateProfilePictureResponse = User;

export type UpdateProfileRequest = {
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say" | null;
};

export type UpdateProfileResponse = User;

export type UpdateAvatarPreferenceRequest = {
  use_oauth_avatar: boolean;
};
export type UpdateAvatarPreferenceResponse = User;

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";

export type ProfilePictureAction =
  "choose_photo" | "take_photo" | "remove_photo";
