export interface ClusterOption {
  id: number;
  name: string;
}

export interface CategoryOption {
  id: number;
  name: string;
  cluster_id: number;
}

export type BusinessPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type BusinessDocument = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type SpecialtyTagColor =
  "blue" | "green" | "purple" | "yellow" | "red" | "teal";

export type SpecialtyTagOption = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
};
