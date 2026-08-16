// UI types

export type ClusterIcon =
  | "utensils"
  | "coffee"
  | "shopping_bag"
  | "store"
  | "bed_double"
  | "hotel"
  | "landmark"
  | "church"
  | "tree_palm"
  | "waves"
  | "mountain"
  | "trees"
  | "compass"
  | "map_pinned"
  | "camera"
  | "music"
  | "ticket"
  | "dumbbell"
  | "heart_pulse"
  | "sparkles"
  | "palette"
  | "book_open"
  | "graduation_cap"
  | "briefcase_business"
  | "car"
  | "bus"
  | "bike"
  | "ship"
  | "paw_print"
  | "leaf";

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

export type SpecialtyTagColor =
  "blue" | "green" | "purple" | "yellow" | "red" | "teal";

export type SpecialtyTagOption = {
  id: number;
  name: string;
  color: SpecialtyTagColor;
};
