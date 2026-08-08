import type { z } from "zod";
import type { merchantRegistrationSchema } from "../../validation/merchantRegistration.schema";

/**
 * Default values used to initialize the merchant registration form.
 *
 * The object is explicitly typed as the Zod input type so fields such as
 * arrays and enum-like values are widened correctly instead of being
 * inferred as literal types (e.g. `never[]` or `""`), allowing the form
 * to be populated with existing application data when resuming a draft.
 */
export const MERCHANT_REGISTRATION_DEFAULT_VALUES: z.input<
  typeof merchantRegistrationSchema
> = {
  businessName: "",
  businessCluster: "",
  businessCategory: "",
  businessDescription: "",
  specialtyTags: [],

  representativeName: "",
  representativeRole: "",
  contactNumber: "",
  businessEmail: "",
  website: "",

  province: "",
  city: "",
  barangay: "",
  streetAddress: "",
  unit: "",
  landmarks: [],
  latitude: null,
  longitude: null,

  operatingHours: {
    monday: {
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    },
    tuesday: {
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    },
    wednesday: {
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    },
    thursday: {
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    },
    friday: {
      isOpen: true,
      is24Hours: false,
      openTime: "08:00",
      closeTime: "17:00",
    },
    saturday: {
      isOpen: false,
      is24Hours: false,
      openTime: "",
      closeTime: "",
    },
    sunday: {
      isOpen: false,
      is24Hours: false,
      openTime: "",
      closeTime: "",
    },
  },

  businessPhotos: {
    storefront: [],
    interior: [],
    products: [],
    additional: [],
  },

  verificationDocuments: {
    businessRegistration: null,
    authorizationDocument: null,
    additionalDocuments: [],
  },
};
