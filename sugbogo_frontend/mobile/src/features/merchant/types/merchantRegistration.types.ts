export interface MerchantRegistrationForm {
  // Step 1: Business Identity
  businessName: string;
  businessCategory: string;
  businessDescription: string;

  contactNumber: string;
  businessEmail: string;
  website: string;

  // Step 2: Business Location
  businessAddress: string;
  latitude: number | null;
  longitude: number | null;
  landmark: string;

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
