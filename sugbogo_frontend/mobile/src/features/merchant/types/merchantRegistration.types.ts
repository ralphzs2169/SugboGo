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
