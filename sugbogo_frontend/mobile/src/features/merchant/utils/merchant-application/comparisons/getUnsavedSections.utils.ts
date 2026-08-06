import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";

import { normalizeIdentity } from "../normalizers/normalizeIdentity.utils";
import { normalizeLocation } from "../normalizers/normalizeLocation.utils";
import { normalizeOperatingHours } from "../normalizers/normalizeOperatingHours.utils";

import { hasIdentityChanged } from "./hasIdentityChanged.utils";
import { hasLocationChanged } from "./hasLocationChanged.utils";
import { hasOperatingHoursChanged } from "./hasOperatingHoursChanged.utils";
import { getPhotoChanges } from "./getPhotoChanges.utils";
import { getDocumentChanges } from "./getDocumentChanges.utils";

import type { NormalizedIdentity } from "../normalizers/normalizeIdentity.utils";
import type { NormalizedLocation } from "../normalizers/normalizeLocation.utils";
import type { NormalizedOperatingHours } from "../normalizers/normalizeOperatingHours.utils";

import { z } from "zod";
import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

type GetUnsavedSectionsParams = {
  values: MerchantRegistrationFormInput;

  lastSavedIdentity: NormalizedIdentity | null;
  lastSavedLocation: NormalizedLocation | null;
  lastSavedOperatingHours: NormalizedOperatingHours | null;

  lastSavedPhotos: MerchantRegistrationForm["businessPhotos"] | null;
  lastSavedDocuments: MerchantRegistrationForm["verificationDocuments"] | null;
};

/**
 * Determines which registration sections contain unsaved changes.
 *
 * Each section is normalized before comparison so change detection
 * uses the same data representation as the save workflow.
 *
 * Returns the display names of every section that has pending changes.
 */
export function getUnsavedSections({
  values,
  lastSavedIdentity,
  lastSavedLocation,
  lastSavedOperatingHours,
  lastSavedPhotos,
  lastSavedDocuments,
}: GetUnsavedSectionsParams) {
  const sections: string[] = [];

  if (hasIdentityChanged(lastSavedIdentity, normalizeIdentity(values))) {
    sections.push("Business Identity");
  }

  if (hasLocationChanged(lastSavedLocation, normalizeLocation(values))) {
    sections.push("Business Location");
  }

  if (
    hasOperatingHoursChanged(
      lastSavedOperatingHours,
      normalizeOperatingHours(values),
    )
  ) {
    sections.push("Operating Hours");
  }

  if (getPhotoChanges(lastSavedPhotos, values.businessPhotos).hasChanges) {
    sections.push("Business Photos");
  }

  if (
    getDocumentChanges(lastSavedDocuments, values.verificationDocuments)
      .hasChanges
  ) {
    sections.push("Verification Documents");
  }

  return sections;
}
