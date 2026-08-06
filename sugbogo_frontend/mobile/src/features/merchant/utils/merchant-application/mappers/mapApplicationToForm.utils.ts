import type { z } from "zod";
import type { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "@/features/merchant/constants/registration/defaultValues.constants";
import { ApplicationDetailResponse } from "@/features/merchant/types/registration/registrationApi.types";
import { mapApplicationPhotos } from "./mapApplicationPhotos.utils";
import { mapApplicationDocuments } from "./mapApplicationDocuments.utils";

export function mapApplicationToForm(
  application: ApplicationDetailResponse,
): z.input<typeof merchantRegistrationSchema> {
  const form = structuredClone(MERCHANT_REGISTRATION_DEFAULT_VALUES);

  if (application.identity) {
    form.businessName = application.identity.business_name;
    form.businessDescription = application.identity.business_description ?? "";
    form.contactNumber = application.identity.contact_number;
    form.businessEmail = application.identity.business_email ?? "";
    form.website = application.identity.website ?? "";

    form.representativeName = application.identity.representative_name;
    form.representativeRole = application.identity.representative_role;

    form.businessCluster = String(application.identity.business_cluster_id);
    form.businessCategory = String(application.identity.business_category_id);

    form.specialtyTags = application.identity.specialty_tags;
  }

  if (application.location) {
    form.province = application.location.province;
    form.city = application.location.city;
    form.barangay = application.location.barangay;
    form.streetAddress = application.location.street_address;
    form.unit = application.location.unit ?? "";

    form.latitude = application.location.latitude;
    form.longitude = application.location.longitude;

    form.landmarks = application.location.landmarks.map((landmark) => ({
      id: String(landmark.id),
      name: landmark.name,
      address: landmark.address ?? "",
      latitude: landmark.latitude ?? 0,
      longitude: landmark.longitude ?? 0,
      source: landmark.source,
      placeId: landmark.place_id ?? undefined,
    }));
  }

  if (application.operating_hours.length > 0) {
    application.operating_hours.forEach((schedule) => {
      form.operatingHours[schedule.day] = {
        isOpen: schedule.is_open,
        is24Hours: schedule.is_24_hours,
        openTime: schedule.open_time?.slice(0, 5) ?? "",
        closeTime: schedule.close_time?.slice(0, 5) ?? "",
      };
    });
  }

  form.businessPhotos = mapApplicationPhotos(application.photos);

  form.verificationDocuments = mapApplicationDocuments(application.documents);

  return form;
}
