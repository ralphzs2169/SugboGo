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

export type SpecialtyTagOption = {
  id: number;
  name: string;
};

export const SPECIALTY_TAGS: SpecialtyTagOption[] = [
  { id: 1, name: "Eco-Friendly" },
  { id: 2, name: "White Sand" },
  { id: 3, name: "Family-Friendly" },
  { id: 4, name: "Pet-Friendly" },
  { id: 5, name: "Beachfront" },
  { id: 6, name: "Nature-Based" },
  { id: 7, name: "Local Products" },
  { id: 8, name: "Local Cuisine" },
  { id: 9, name: "Cultural Experience" },
  { id: 10, name: "Outdoor Activities" },
  { id: 11, name: "Adventure" },
  { id: 12, name: "Scenic Views" },
];
