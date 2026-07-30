export interface MerchantRegistrationForm {
  // Step 1: Business Identity
  businessName: string;
  businessCluster: string;
  businessCategory: string;
  businessDescription: string;

  contactNumber: string;
  businessEmail: string;
  website: string;

  representativeName: string;
  representativeRole: string;

  // Step 2: Business Location
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  unit: string;
  landmark: string;

  latitude: number | null;
  longitude: number | null;

  // Step 3: Operating Hours
  operatingHours: {
    monday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    tuesday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    wednesday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    thursday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    friday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    saturday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
    sunday: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
  };

  // Step 4: Business Photos
  businessPhotos: string[];

  // Step 5: Verification Documents
  verificationDocuments: string[];

  // Step 6: Review
}

export interface ClusterOption {
  id: number;
  name: string;
}

export interface CategoryOption {
  id: number;
  name: string;
  cluster_id: number;
}
