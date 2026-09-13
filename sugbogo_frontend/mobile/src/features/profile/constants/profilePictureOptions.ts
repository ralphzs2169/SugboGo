import { theme } from "@/constants/theme";
import { ProfilePictureAction } from "../types/profile.types";

/**
 * This file contains the profile picture options used in the edit profile feature of the application.
 * Each option has a label, value, and an associated icon.
 */
export const PROFILE_PICTURE_OPTIONS = [
  {
    label: "Choose SugboGo Avatar",
    value: "choose_avatar",
    icon: "account-circle-outline",
  },
  {
    label: "Upload Photo",
    value: "upload_photo",
    icon: "camera-outline",
  },
  {
    label: "Remove Photo",
    value: "remove_photo",
    icon: "delete-outline",
    color: theme.extends.colors.error,
  },
] satisfies {
  label: string;
  value: ProfilePictureAction;
  icon: string;
  color?: string;
}[];
