import type { ClusterIcon } from "@/shared/types/cluster.types";

import type {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";

export type InterestCluster = {
  id: number;
  name: string;
  icon: ClusterIcon;
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
  icon: SpecialtyTagIcon | null;
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
