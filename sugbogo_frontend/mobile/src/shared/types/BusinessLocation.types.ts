export type BusinessLocationAddress = {
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  formattedAddress: string;
};

export type BusinessLocation = BusinessLocationAddress & {
  latitude: number;
  longitude: number;
};
