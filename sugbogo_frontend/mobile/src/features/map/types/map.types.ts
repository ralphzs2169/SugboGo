export type HiddenGem = {
  id: string;
  name: string;
  photoUrl: string;
  tags: string[];
  category: "Culinary" | "Leisure" | "Creative";
  location: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  isInterestMatch?: boolean;
  isDiscoverMore?: boolean;
  isTrending?: boolean;
  trendDirection?: "up" | "down";
  trendValue?: number;
};
