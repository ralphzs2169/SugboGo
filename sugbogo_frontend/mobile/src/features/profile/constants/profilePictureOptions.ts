import { theme } from "@/constants/theme";
import { ProfilePictureAction } from "../types/profile.types";

/**
 * This file contains the profile picture options used in the edit profile feature of the application.
 * Each option has a label, value, and an associated icon.
 */
export const PROFILE_PICTURE_OPTIONS = [
  {
    label: "Choose Photo",
    value: "choose_photo",
    icon: "image-outline",
  },
  {
    label: "Take Photo",
    value: "take_photo",
    icon: "camera-outline",
  },
  {
    label: "Remove Current Photo",
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
