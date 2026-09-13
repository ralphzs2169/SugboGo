import { User } from "@/features/users/types/user.types";
import type { AvatarKey } from "@/shared/constants/avatars";

export type UpdateProfilePictureResponse = User;

export type UpdateProfileRequest = {
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say" | null;
  avatar_key?: AvatarKey | null;
};

export type UpdateProfileResponse = User;

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";

export type ProfilePictureAction =
  "choose_avatar" | "upload_photo" | "remove_photo";
