import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import BusinessProfileSection from "@/features/explore/components/business-profile/BusinessProfileSection";
import MerchantAccessDirections from "@/features/explore/components/getting-there/MerchantAccessDirections";
import { formatTime } from "@/features/explore/utils/businessHours.utils";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { OfflineBusinessSnapshot } from "../validation/offlineBusinessSnapshot";
import OfflineBusinessCover from "./OfflineBusinessCover";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Read-only profile information with source-specific wording and no live hooks or actions. */
export default function OfflineBusinessContent({
  snapshot,
  localCoverUri,
  source = "offline-pocket",
}: {
  snapshot: OfflineBusinessSnapshot;
  localCoverUri?: string;
  source?: "offline-pocket" | "recent";
}) {
  const business = snapshot.business;
  const contacts = [
    { label: "Phone", value: business.contact_number },
    { label: "Email", value: business.email },
    { label: "Website", value: business.website },
  ].filter((contact) => Boolean(contact.value));
  return (
    <View className="pb-6">
      {/* Hero uses the online profile's cover proportions and placeholder, without overlays/actions. */}
      <View className="relative h-[21.5rem] w-full overflow-hidden rounded-b-3xl bg-surface-muted">
        <OfflineBusinessCover
          uri={
            source === "recent"
              ? business.display_cover_photo_url ||
                business.cover_photo_url ||
                undefined
              : localCoverUri
          }
          allowRemote={source === "recent"}
          clusterIcon={business.cluster.icon}
          hero
        />
      </View>
      <View className="gap-2 bg-surface px-screen-x py-5">
        <AppText
          accessibilityRole="header"
          weight="bold"
          className="text-2xl text-text-primary"
        >
          {business.business_name}
        </AppText>
        <AppText className="text-sm text-text-secondary">
          {business.cluster.name} · {business.category.name}
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {business.specialty_tags.map((tag) => (
            <SpecialtyTagChip key={tag.id} tag={tag} size="small" showIcon />
          ))}
        </View>
        <AppText className="mt-1 text-xs leading-5 text-text-secondary">
          {source === "recent"
            ? "Showing previously loaded information"
            : "Device copy"}{" "}
          · Updated {new Date(snapshot.fetchedAt).toLocaleString()}. Information
          may have changed.
        </AppText>
      </View>
      {/* Reuses the online profile's section hierarchy, without its data-fetching children. */}
      <BusinessProfileSection title="About">
        <AppText className="text-sm leading-6 text-text-secondary">
          {business.description?.trim() || "No description was provided."}
        </AppText>
      </BusinessProfileSection>
      <BusinessProfileSection title="Location">
        <View className="flex-row items-start gap-3">
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={22}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
          <AppText
            selectable
            className="min-w-0 flex-1 text-sm leading-6 text-text-secondary"
          >
            {[
              business.location.address,
              business.location.city,
              business.location.province,
            ]
              .filter(Boolean)
              .join(", ") || "No address was provided."}
          </AppText>
        </View>
        <MerchantAccessDirections
          directions={business.access_directions}
          presentation="inline"
        />
      </BusinessProfileSection>
      <BusinessProfileSection title="Operating hours">
        <View className="gap-3">
          {DAYS.map((day) => {
            const hours = business.operating_hours.find(
              (row) => row.day === day,
            );
            const label = !hours
              ? "Not provided"
              : !hours.is_open
                ? "Closed"
                : hours.is_24_hours
                  ? "24 hours"
                  : hours.open_time && hours.close_time
                    ? `${formatTime(hours.open_time)} – ${formatTime(hours.close_time)}`
                    : "Hours not provided";
            return (
              <View
                key={day}
                className="flex-row flex-wrap justify-between gap-x-4 gap-y-1"
              >
                <AppText className="text-sm capitalize text-text-primary">
                  {day}
                </AppText>
                <AppText className="shrink text-sm text-text-secondary">
                  {label}
                </AppText>
              </View>
            );
          })}
        </View>
      </BusinessProfileSection>
      <BusinessProfileSection title="Contact information">
        <View className="gap-4">
          {contacts.length ? (
            contacts.map((contact) => (
              <View key={contact.label} className="gap-1">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-secondary"
                >
                  {contact.label}
                </AppText>
                <AppText
                  selectable
                  className="text-sm leading-5 text-text-primary"
                >
                  {contact.value}
                </AppText>
              </View>
            ))
          ) : (
            <AppText className="text-sm text-text-secondary">
              No contact information was provided.
            </AppText>
          )}
        </View>
      </BusinessProfileSection>
    </View>
  );
}
