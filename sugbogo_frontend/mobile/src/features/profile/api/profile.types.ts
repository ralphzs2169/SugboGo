import { User } from "@/features/auth/api/auth.types";

export type UpdateProfilePictureResponse = {
  avatar_url: string | null;
};

export type UpdateProfileRequest = {
  first_name: string;
  last_name: string;
};

export type UpdateProfileResponse = User;
