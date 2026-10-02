import { Image } from "expo-image";
import { ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatTime } from "@/features/explore/utils/businessHours.utils";
import type {
  MerchantBusinessOperatingHours,
  MerchantBusinessProfileResponse,
} from "../../types/merchantBusinessProfile.types";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const PHOTO_CATEGORIES = [
  "storefront",
  "interior",
  "products",
  "additional",
] as const;

const DOCUMENT_LABELS = {
  business_registration: "Business Registration",
  authorization_document: "Authorization Document",
  additional_documents: "Additional Document",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  authorized_representative: "Authorized Representative",
  other: "Other",
};

function displayValue(value: string | null | undefined) {
  return value?.trim() || "Not provided";
}

function formatHours(hours: MerchantBusinessOperatingHours | undefined) {
  if (!hours) {
    return "Not provided";
  }

  if (!hours.is_open) {
    return "Closed";
  }

  if (hours.is_24_hours) {
    return "Open 24 hours";
  }

  if (!hours.open_time || !hours.close_time) {
    return "Hours not provided";
  }

  const overnight = hours.close_time <= hours.open_time;
  const closeLabel = formatTime(hours.close_time);

  return `${formatTime(hours.open_time)} – ${closeLabel}${
    overnight ? " (next day)" : ""
  }`;
}

/** Groups read-only business facts in the established profile card style. */
function BusinessSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-2 bg-surface px-5 py-5">
      <AppText weight="bold" className="mb-4 text-base text-text-primary">
        {title}
      </AppText>
      <View className="border-t border-border-primary pt-4">{children}</View>
    </View>
  );
}

/** Renders one labeled profile value without implying that it can be edited. */
function BusinessField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View className="mb-4">
      <AppText className="mb-1 text-xs text-text-secondary">{label}</AppText>
      <AppText className="text-sm leading-5 text-text-primary">
        {displayValue(value)}
      </AppText>
    </View>
  );
}

/** Displays the approved listing and retained onboarding evidence as read-only sections. */
export default function MerchantBusinessOverview({
  business,
}: {
  business: MerchantBusinessProfileResponse;
}) {
  const location = business.location;
  const verification = business.verification;

  return (
    <View>
      {/* Business information */}
      <BusinessSection title="Business Information">
        <BusinessField label="Description" value={business.description} />
        <BusinessField label="Contact number" value={business.contact_number} />
        <BusinessField label="Business email" value={business.business_email} />
        <BusinessField label="Website" value={business.website} />
      </BusinessSection>

      {/* Classification */}
      <BusinessSection title="Classification">
        <BusinessField label="Cluster" value={business.cluster.name} />
        <BusinessField label="Category" value={business.category.name} />
        <AppText className="mb-2 text-xs text-text-secondary">
          Specialty tags
        </AppText>
        {business.specialty_tags.length > 0 ? (
          <View className="flex-row flex-wrap">
            {business.specialty_tags.map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
            ))}
          </View>
        ) : (
          <AppText className="text-sm text-text-secondary">
            No active specialties
          </AppText>
        )}
      </BusinessSection>

      {/* Approved location */}
      <BusinessSection title="Location">
        <BusinessField label="Address" value={location.address} />
        <BusinessField
          label="City / Province"
          value={`${location.city}, ${location.province}`}
        />
        <BusinessField label="Postal code" value={location.postal_code} />
        <BusinessField
          label="Coordinates"
          value={`${location.latitude}, ${location.longitude}`}
        />
        <AppText className="mb-2 text-xs text-text-secondary">
          Landmarks
        </AppText>
        {location.landmarks.length > 0 ? (
          location.landmarks.map((landmark) => (
            <View key={landmark.id} className="mb-3">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {landmark.name}
              </AppText>
              <AppText className="text-xs text-text-secondary">
                {landmark.address}
              </AppText>
            </View>
          ))
        ) : (
          <AppText className="text-sm text-text-secondary">
            No landmarks listed
          </AppText>
        )}
      </BusinessSection>

      {/* Current operating hours */}
      <BusinessSection title="Operating Hours">
        {DAYS.map((day) => {
          const hours = business.operating_hours.find(
            (item) => item.day === day,
          );

          return (
            <View key={day} className="flex-row justify-between py-2">
              <AppText className="w-24 text-sm capitalize text-text-secondary">
                {day}
              </AppText>
              <AppText className="flex-1 text-right text-sm text-text-primary">
                {formatHours(hours)}
              </AppText>
            </View>
          );
        })}
      </BusinessSection>

      {/* Approved business photos */}
      <BusinessSection title="Photos">
        {PHOTO_CATEGORIES.map((category) => {
          const photos = business.photos.filter(
            (photo) => photo.category === category,
          );

          return (
            <View key={category} className="mb-4">
              <AppText
                weight="semibold"
                className="mb-2 text-sm capitalize text-text-primary"
              >
                {category}
              </AppText>
              {photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {photos.map((photo) => (
                    <View key={photo.id} className="mr-3 w-28">
                      <Image
                        source={{ uri: photo.url }}
                        contentFit="cover"
                        className="h-28 w-28 rounded-xl bg-surface-secondary"
                        accessibilityLabel={`${category} photo ${photo.id}`}
                      />
                      {photo.file_name ? (
                        <AppText
                          className="mt-1 text-xs text-text-secondary"
                          numberOfLines={1}
                        >
                          {photo.file_name}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <AppText className="text-sm text-text-secondary">
                  No photos listed
                </AppText>
              )}
            </View>
          );
        })}
      </BusinessSection>

      {/* Retained onboarding evidence */}
      <BusinessSection title="Verification Information">
        <AppText className="mb-4 text-xs leading-5 text-text-secondary">
          These details were submitted during your original application.
        </AppText>
        <BusinessField
          label="Business representative"
          value={verification?.representative_name}
        />
        <BusinessField
          label="Representative role"
          value={
            verification?.representative_role
              ? ROLE_LABELS[verification.representative_role] ||
                verification.representative_role
              : null
          }
        />
        <AppText className="mb-2 text-xs text-text-secondary">
          Submitted documents
        </AppText>
        {verification?.documents.length ? (
          verification.documents.map((document) => (
            <View key={document.id} className="mb-3">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {DOCUMENT_LABELS[document.document_type]}
              </AppText>
              {document.file_name ? (
                <AppText className="text-xs text-text-secondary">
                  {document.file_name}
                </AppText>
              ) : null}
            </View>
          ))
        ) : (
          <AppText className="text-sm text-text-secondary">
            No documents listed
          </AppText>
        )}
      </BusinessSection>
    </View>
  );
}
