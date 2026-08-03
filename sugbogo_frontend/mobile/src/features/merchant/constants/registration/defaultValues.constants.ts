import type { z } from "zod";
import type { merchantRegistrationSchema } from "../../validation/merchantRegistration.schema";

export const MERCHANT_REGISTRATION_DEFAULT_VALUES = {
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
} satisfies z.input<typeof merchantRegistrationSchema>;
