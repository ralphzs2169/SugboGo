import { ClusterIcon } from "@/shared/types/cluster.types";
import {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";

export interface ClusterOption {
  id: number;
  name: string;
  icon: ClusterIcon;
}

export interface CategoryOption {
  id: number;
  name: string;
  cluster_id: number;
}

export type BusinessPhoto = {
  id?: number;
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type BusinessDocument = {
  id?: number;
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type SpecialtyTagOption = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
  icon: SpecialtyTagIcon;
};
