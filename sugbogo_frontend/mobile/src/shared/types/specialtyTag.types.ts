import { SPECIALTY_TAG_ICONS } from "@/shared/constants/specialtyTagIcons";

export type SpecialtyTagIcon = keyof typeof SPECIALTY_TAG_ICONS;

export type SpecialtyTagColor =
  "blue" | "green" | "purple" | "yellow" | "red" | "teal";

export type SpecialtyTag = {
  name: string;
  color: SpecialtyTagColor;
  icon?: SpecialtyTagIcon | null;
};
