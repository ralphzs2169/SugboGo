import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import LocationPickerMap from "@/features/merchant/components/registration/location/LocationPickerMap";
import { getBusinessAddressDisplay } from "@/features/explore/utils/businessLocation.utils";
import {
  formatTime,
  getBusinessHoursSummary,
} from "@/features/explore/utils/businessHours.utils";
import type {
  MerchantBusinessOperatingHours,
  MerchantBusinessProfileResponse,
} from "../../types/merchantBusinessProfile.types";
import type { ClassificationChangeRequest } from "../../types/classificationChange.types";
import type { LocationChangeRequest } from "../../types/locationChange.types";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
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

function formatHours(hours: MerchantBusinessOperatingHours | undefined) {
  if (!hours) return "Hours unavailable";
  if (!hours.is_open) return "Closed";
  if (hours.is_24_hours) return "Open 24 hours";
  if (!hours.open_time || !hours.close_time) return "Hours unavailable";

  const overnight = hours.close_time <= hours.open_time;
  return `${formatTime(hours.open_time)} – ${formatTime(hours.close_time)}${overnight ? " (next day)" : ""}`;
}

/** Frames a compact business summary with the established profile surface. */
function SummarySection({
  title,
  children,
  actionLabel,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const isPending = actionLabel === "Pending review";

  return (
    <View className="mb-2 bg-surface px-5 py-4">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <AppText weight="bold" className="flex-1 text-base text-text-primary">
          {title}
        </AppText>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={
              isPending
                ? `View pending ${title.toLowerCase()} request`
                : `${actionLabel} ${title.toLowerCase()}`
            }
            className="min-h-11 cursor-pointer flex-row items-center rounded-lg px-2 active:bg-background"
          >
            {isPending ? (
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={theme.extends.colors.text.secondary}
              />
            ) : null}
            <AppText
              weight="semibold"
              className={`text-sm ${isPending ? "ml-1 text-text-secondary" : "text-brand"}`}
              numberOfLines={1}
            >
              {actionLabel}
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Shows the live merchant listing as concise, glanceable sections. */
export default function MerchantBusinessOverview({
  business,
  onEditInformation,
  onEditOperatingHours,
  onManagePhotos,
  onSwitchToExplorer,
  pendingClassificationRequest,
  isCheckingClassification,
  hasClassificationError,
  onClassificationHistory,
  onRetryClassification,
  pendingLocationRequest,
  isCheckingLocation,
  hasLocationError,
  onLocationHistory,
  onRetryLocation,
}: {
  business: MerchantBusinessProfileResponse;
  onEditInformation?: () => void;
  onEditOperatingHours?: () => void;
  onManagePhotos?: () => void;
  onSwitchToExplorer?: () => void;
  pendingClassificationRequest?: ClassificationChangeRequest | null;
  isCheckingClassification?: boolean;
  hasClassificationError?: boolean;
  onClassificationHistory?: () => void;
  onRetryClassification?: () => void;
  pendingLocationRequest?: LocationChangeRequest | null;
  isCheckingLocation?: boolean;
  hasLocationError?: boolean;
  onLocationHistory?: () => void;
  onRetryLocation?: () => void;
}) {
  const [weeklyHoursVisible, setWeeklyHoursVisible] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const today = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
    })
    .toLowerCase();
  const todayHours = business.operating_hours.find(
    (hours) => hours.day.toLowerCase() === today,
  );
  const hoursSummary = getBusinessHoursSummary(
    business.operating_hours.map((hours, index) => ({
      ...hours,
      id: index,
    })),
  );
  const address = getBusinessAddressDisplay(business.location);
  const canEdit = business.status === "active";

  return (
    <View>
      {/* Live business information */}
      <SummarySection
        title="Business Information"
        actionLabel={canEdit ? "Edit" : undefined}
        onAction={onEditInformation}
      >
        <AppText className="mb-3 text-sm leading-5 text-text-primary">
          {business.description?.trim() || "No description added yet"}
        </AppText>
        {(
          [
            ["phone-outline", business.contact_number],
            ["email-outline", business.business_email],
            ["web", business.website],
          ] as const
        ).map(([icon, value]) =>
          value ? (
            <View key={icon} className="min-h-9 flex-row items-center py-1">
              <MaterialCommunityIcons
                name={icon}
                size={18}
                color={theme.extends.colors.text.secondary}
              />
              <AppText
                className="ml-3 flex-1 text-sm text-text-primary"
                numberOfLines={2}
              >
                {value}
              </AppText>
            </View>
          ) : null,
        )}
      </SummarySection>

      {/* Approved classification */}
      <SummarySection
        title="Classification"
        actionLabel={
          pendingClassificationRequest ? "Pending review" : undefined
        }
        onAction={onClassificationHistory}
      >
        <AppText weight="semibold" className="text-sm text-text-primary">
          {business.category.name} · {business.cluster.name}
        </AppText>
        {business.specialty_tags.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {business.specialty_tags.map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
            ))}
          </View>
        ) : null}
        {isCheckingClassification ? (
          <AppText className="mt-2 text-xs text-text-secondary">
            Checking request status...
          </AppText>
        ) : hasClassificationError ? (
          <Pressable onPress={onRetryClassification} accessibilityRole="button">
            <AppText className="mt-2 text-sm text-brand">
              Retry request status
            </AppText>
          </Pressable>
        ) : null}
      </SummarySection>

      {/* Approved location */}
      <SummarySection
        title="Location"
        actionLabel={pendingLocationRequest ? "Pending review" : undefined}
        onAction={onLocationHistory}
      >
        <View className="overflow-hidden rounded-xl bg-surface-secondary">
          <LocationPickerMap
            latitude={business.location.latitude}
            longitude={business.location.longitude}
            interactionEnabled={false}
            showLocationPreviewOverlay={false}
            previewHeight={156}
          />
        </View>
        {address.addressLine ? (
          <AppText weight="semibold" className="mt-3 text-sm text-text-primary">
            {address.addressLine}
          </AppText>
        ) : null}
        {address.cityLine ? (
          <AppText className="mt-0.5 text-sm text-text-secondary">
            {address.cityLine}
          </AppText>
        ) : null}
        <AppText className="mt-2 text-xs text-text-secondary">
          {business.location.landmarks.length} landmark
          {business.location.landmarks.length === 1 ? "" : "s"}
        </AppText>
        {isCheckingLocation ? (
          <AppText className="mt-2 text-xs text-text-secondary">
            Checking request status...
          </AppText>
        ) : hasLocationError ? (
          <Pressable onPress={onRetryLocation} accessibilityRole="button">
            <AppText className="mt-2 text-sm text-brand">
              Retry request status
            </AppText>
          </Pressable>
        ) : null}
      </SummarySection>

      {/* Today's hours and optional weekly schedule */}
      <SummarySection
        title="Operating Hours"
        actionLabel={canEdit ? "Edit" : undefined}
        onAction={onEditOperatingHours}
      >
        <View className="flex-row flex-wrap items-center gap-2">
          <View
            className={`h-2 w-2 rounded-full ${
              hoursSummary.isOpen ? "bg-success" : "bg-text-error"
            }`}
          />
          <AppText
            weight="semibold"
            className="flex-1 text-sm text-text-primary"
          >
            {hoursSummary.label}
          </AppText>
        </View>
        <View className="mt-3 flex-row justify-between gap-3">
          <AppText className="text-sm text-text-secondary">Today</AppText>
          <AppText className="flex-1 text-right text-sm text-text-primary">
            {formatHours(todayHours)}
          </AppText>
        </View>
        <Pressable
          onPress={() => setWeeklyHoursVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityState={{ expanded: weeklyHoursVisible }}
          className="mt-2 min-h-11 cursor-pointer flex-row items-center active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            {weeklyHoursVisible
              ? "Hide weekly schedule"
              : "View weekly schedule"}
          </AppText>
          <MaterialCommunityIcons
            name={weeklyHoursVisible ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.extends.colors.brand}
          />
        </Pressable>
        {weeklyHoursVisible ? (
          <View className="border-t border-border-primary/60 pt-2">
            {DAYS.map((day) => (
              <View key={day} className="flex-row justify-between gap-3 py-2">
                <AppText className="text-sm capitalize text-text-secondary">
                  {day}
                </AppText>
                <AppText className="flex-1 text-right text-sm text-text-primary">
                  {formatHours(
                    business.operating_hours.find((hours) => hours.day === day),
                  )}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </SummarySection>

      {/* Visual photo preview */}
      <SummarySection
        title="Photos"
        actionLabel={canEdit ? "Manage" : undefined}
        onAction={onManagePhotos}
      >
        {business.photos.length > 0 ? (
          <View className="flex-row gap-2">
            {business.photos.slice(0, 3).map((photo, index) => (
              <View
                key={photo.id}
                className="aspect-square w-[31%] overflow-hidden rounded-xl bg-surface-secondary"
              >
                <Image
                  source={{ uri: photo.url }}
                  contentFit="cover"
                  style={{ width: "100%", height: "100%" }}
                  accessibilityLabel={`Business photo ${index + 1}`}
                />
                {index === 2 && business.photos.length > 3 ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/45">
                    <AppText weight="bold" className="text-lg text-white">
                      +{business.photos.length - 3}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <AppText className="text-sm text-text-secondary">
            No photos yet
          </AppText>
        )}
        <AppText className="mt-2 text-xs text-text-secondary">
          {business.photos.length} business photo
          {business.photos.length === 1 ? "" : "s"}
        </AppText>
      </SummarySection>

      {/* Quieter secondary information and mode switch */}
      <View className="mb-2 bg-surface px-5 pb-2 pt-4">
        <AppText weight="bold" className="mb-1 text-base text-text-primary">
          More
        </AppText>
        <Pressable
          onPress={() => setVerificationVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityState={{ expanded: verificationVisible }}
          className="min-h-14 cursor-pointer flex-row items-center active:opacity-70"
        >
          <View className="flex-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Business Verification
            </AppText>
            <AppText className="mt-0.5 text-xs text-text-secondary">
              Original application & documents
            </AppText>
          </View>
          <MaterialCommunityIcons
            name={verificationVisible ? "chevron-up" : "chevron-right"}
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
        {verificationVisible ? (
          <View className="border-t border-border-primary/60 py-3">
            <AppText className="text-xs text-text-secondary">
              Representative
            </AppText>
            <AppText className="text-sm text-text-primary">
              {business.verification?.representative_name || "Not provided"}
            </AppText>
            <AppText className="mt-3 text-xs text-text-secondary">Role</AppText>
            <AppText className="text-sm text-text-primary">
              {business.verification?.representative_role
                ? ROLE_LABELS[business.verification.representative_role] ||
                  business.verification.representative_role
                : "Not provided"}
            </AppText>
            <AppText className="mt-3 text-xs text-text-secondary">
              Submitted documents
            </AppText>
            {business.verification?.documents.length ? (
              business.verification.documents.map((document) => (
                <View key={document.id} className="mt-1">
                  <AppText className="text-sm text-text-primary">
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
          </View>
        ) : null}
        {onSwitchToExplorer ? (
          <Pressable
            onPress={onSwitchToExplorer}
            accessibilityRole="button"
            className="min-h-12 cursor-pointer flex-row items-center border-t border-border-primary/60 active:opacity-70"
          >
            <MaterialCommunityIcons
              name="compass-outline"
              size={19}
              color={theme.extends.colors.text.secondary}
            />
            <AppText className="ml-3 flex-1 text-sm text-text-primary">
              Switch to Explorer
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
