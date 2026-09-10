import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

export type InterestCluster = {
  id: number;
  name: string;
};

export type InterestCategory = {
  id: number;
  name: string;
  cluster: InterestCluster;
};

export type InterestSpecialtyTag = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
};

export type UserInterests = {
  categories: InterestCategory[];
  specialty_tags: InterestSpecialtyTag[];
  available_categories: InterestCategory[];
  available_specialty_tags: InterestSpecialtyTag[];
};

export type UpdateInterestsPayload = {
  category_ids: number[];
  specialty_tag_ids: number[];
};
