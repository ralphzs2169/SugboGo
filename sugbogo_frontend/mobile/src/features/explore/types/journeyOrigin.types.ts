export type JourneyOrigin = {
  type: "current" | "selected";
  latitude: number;
  longitude: number;
  label: string;
};
