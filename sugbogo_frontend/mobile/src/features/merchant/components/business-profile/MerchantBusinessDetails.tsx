import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { getBusinessAddressDisplay } from "@/features/explore/utils/businessLocation.utils";
import {
  formatTime,
  getBusinessHoursSummary,
} from "@/features/explore/utils/businessHours.utils";
import AppText from "@/shared/components/AppText";
import FullScreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";

import LocationPickerMap from "../registration/location/LocationPickerMap";
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

const DOCUMENT_LABELS: Record<string, string> = {
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

  return `${formatTime(hours.open_time)} – ${formatTime(hours.close_time)}${
    overnight ? " (next day)" : ""
  }`;
}

type Props = {
  business: MerchantBusinessProfileResponse;
  onEditOperatingHours?: () => void;
  onManagePhotos?: () => void;
  onSwitchToExplorer?: () => void;
  isSwitchingToExplorer?: boolean;
  onEditInformation?: () => void;
  onViewMap?: () => void;
  onViewDocument?: (documentId: number) => void;
  openingDocumentId?: number | null;
};

/**
 * Displays the merchant's live photos and essential business details.
 *
 * Keeps the main profile sections full-width while presenting operating
 * hours, address information, and contacts in subtly bordered panels.
 * Supports expandable schedules, contact actions, document summaries,
 * photo viewing, and merchant management shortcuts.
 */
export default function MerchantBusinessDetails({
  business,
  onEditOperatingHours,
  onEditInformation,
  onViewMap,
  onViewDocument,
  openingDocumentId,
  onManagePhotos,
  onSwitchToExplorer,
  isSwitchingToExplorer = false,
}: Props) {
  const [weeklyHoursVisible, setWeeklyHoursVisible] = useState(false);
  const [contactDetailsVisible, setContactDetailsVisible] = useState(true);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "long" })
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

  const hasOperatingHours = business.operating_hours.length > 0;

  const hoursStatusLabel = !hasOperatingHours
    ? "Hours unavailable"
    : hoursSummary.isOpen
      ? "Open now"
      : "Closed now";

  const canEdit = business.status === "active";
  const address = getBusinessAddressDisplay(business.location);

  const contactDetails = [
    ["phone", "phone-outline", business.contact_number],
    ["email", "email-outline", business.business_email],
    ["website", "web", business.website],
  ] as const;

  const viewerPhotos = business.photos.map((photo) => ({
    uri: photo.url,
    category: photo.category,
  }));

  function handlePhotoPress(index: number) {
    setSelectedPhotoIndex(index);
    setPhotoViewerVisible(true);
  }

  function handleContactPress(
    kind: "phone" | "email" | "website",
    value: string,
  ) {
    const url =
      kind === "phone"
        ? `tel:${value}`
        : kind === "email"
          ? `mailto:${value}`
          : /^https?:\/\//i.test(value)
            ? value
            : `https://${value}`;

    void Linking.openURL(url).catch(() => {
      Toast.show({
        type: "error",
        text1: "Unable to open contact detail",
        text2: "Please try again.",
      });
    });
  }

  return (
    <View className="bg-background pb-2">
      {/* Full-width business photos section */}
      <View className="mb-2 mt-2 bg-surface px-5 pb-5 pt-4">
        {/* Photos section heading */}
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <AppText weight="bold" className="flex-1 text-base text-text-primary">
            Photos
          </AppText>

          {canEdit && onManagePhotos ? (
            <Pressable
              onPress={onManagePhotos}
              accessibilityRole="button"
              accessibilityLabel="Manage business photos"
              className="min-h-11 cursor-pointer flex-row items-center gap-1 px-2 active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-brand">
                Manage
              </AppText>

              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={theme.extends.colors.brand}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Business photo gallery */}
        {business.photos.length > 0 ? (
          <View className="h-48 flex-row gap-2">
            <Pressable
              onPress={() => handlePhotoPress(0)}
              accessibilityRole="button"
              accessibilityLabel="View business photo 1"
              className="min-w-0 flex-[2] cursor-pointer overflow-hidden rounded-xl bg-surface-secondary active:opacity-90"
            >
              <Image
                source={{ uri: business.photos[0].url }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
                accessibilityLabel="Business photo 1"
              />
            </Pressable>

            {business.photos.length > 1 ? (
              <View className="min-w-0 flex-1 gap-2">
                {business.photos.slice(1, 3).map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => handlePhotoPress(index + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`View business photo ${index + 2}`}
                    className="min-h-0 flex-1 cursor-pointer overflow-hidden rounded-xl bg-surface-secondary active:opacity-90"
                  >
                    <Image
                      source={{ uri: photo.url }}
                      contentFit="cover"
                      style={{ width: "100%", height: "100%" }}
                      accessibilityLabel={`Business photo ${index + 2}`}
                    />

                    {index === 1 && business.photos.length > 3 ? (
                      <View className="absolute inset-0 items-center justify-center bg-black/55">
                        <AppText weight="bold" className="text-lg text-white">
                          +{business.photos.length - 3}
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View className="items-center justify-center rounded-xl bg-background px-5 py-8">
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={28}
              color={theme.extends.colors.text.tertiary}
            />

            <AppText className="mt-2 text-sm text-text-secondary">
              No business photos yet
            </AppText>
          </View>
        )}

        {/* Photo count */}
        <AppText className="mt-2 text-xs text-text-secondary">
          {business.photos.length} business photo
          {business.photos.length === 1 ? "" : "s"}
        </AppText>

        <FullScreenPhotoViewer
          photos={viewerPhotos}
          visible={photoViewerVisible}
          initialIndex={selectedPhotoIndex}
          onClose={() => setPhotoViewerVisible(false)}
        />
      </View>

      {/* Full-width business details section */}
      <View className="mb-2 bg-surface px-5 pb-2 pt-4">
        <AppText weight="bold" className="text-base text-text-primary">
          Business details
        </AppText>

        {/* Operating hours */}
        <View className="pb-4 pt-4">
          {/* Section heading and edit action */}
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="semibold"
              className="flex-1 text-sm text-text-primary"
            >
              Operating hours
            </AppText>

            {canEdit && onEditOperatingHours ? (
              <Pressable
                onPress={onEditOperatingHours}
                accessibilityRole="button"
                accessibilityLabel="Edit operating hours"
                className="min-h-11 cursor-pointer flex-row items-center gap-1 px-2 active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  Edit
                </AppText>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={theme.extends.colors.brand}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Bordered operating hours card */}
          <View className="mt-2 rounded-xl border border-border-primary bg-surface px-3 py-3">
            {/* Current operating status */}
            <View className="flex-row items-center">
              <View
                className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${
                  hasOperatingHours && hoursSummary.isOpen
                    ? "bg-success/10"
                    : "bg-background"
                }`}
              >
                <View
                  className={`h-2 w-2 rounded-full ${
                    hasOperatingHours && hoursSummary.isOpen
                      ? "bg-success"
                      : "bg-text-secondary"
                  }`}
                />

                <AppText
                  weight="semibold"
                  className={`text-xs ${
                    hasOperatingHours && hoursSummary.isOpen
                      ? "text-success"
                      : "text-text-secondary"
                  }`}
                >
                  {hoursStatusLabel}
                </AppText>
              </View>
            </View>

            {/* Today's scheduled hours */}
            {hasOperatingHours ? (
              <View className="mt-3 flex-row items-start justify-between gap-3">
                <AppText className="text-sm text-text-secondary">
                  Today&apos;s hours
                </AppText>

                <AppText
                  weight="medium"
                  className="min-w-0 flex-1 text-right text-sm leading-5 text-text-primary"
                >
                  {formatHours(todayHours)}
                </AppText>
              </View>
            ) : null}

            {/* Expandable weekly schedule */}
            {hasOperatingHours ? (
              <>
                <Pressable
                  onPress={() => setWeeklyHoursVisible((visible) => !visible)}
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: weeklyHoursVisible,
                  }}
                  accessibilityLabel={
                    weeklyHoursVisible
                      ? "Hide weekly operating schedule"
                      : "View weekly operating schedule"
                  }
                  className="mt-3 min-h-11 cursor-pointer flex-row items-center justify-between gap-2 border-t border-border-primary/60 pt-2 active:opacity-70"
                >
                  <AppText
                    weight="medium"
                    className="flex-1 text-sm text-text-primary"
                  >
                    {weeklyHoursVisible
                      ? "Hide weekly hours"
                      : "Weekly schedule"}
                  </AppText>

                  <MaterialCommunityIcons
                    name={weeklyHoursVisible ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.extends.colors.text.secondary}
                  />
                </Pressable>

                {/* Expanded weekly schedule */}
                {weeklyHoursVisible ? (
                  <View className="mt-2 gap-1">
                    {DAYS.map((day) => {
                      const isToday = day === today;

                      const dayHours = business.operating_hours.find(
                        (hours) => hours.day.toLowerCase() === day,
                      );

                      return (
                        <View
                          key={day}
                          className={`flex-row items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 ${
                            isToday ? "bg-brand/10" : ""
                          }`}
                        >
                          <AppText
                            weight={isToday ? "semibold" : "regular"}
                            className={`w-10 text-sm ${
                              isToday ? "text-brand" : "text-text-secondary"
                            }`}
                          >
                            {day
                              .slice(0, 3)
                              .replace(/^./, (char) => char.toUpperCase())}
                          </AppText>

                          <AppText
                            weight={isToday ? "semibold" : "regular"}
                            className="min-w-0 flex-1 text-right text-sm leading-5 text-text-primary"
                            numberOfLines={2}
                          >
                            {formatHours(dayHours)}
                          </AppText>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        {/* Location and landmarks */}
        <View className="border-t border-border-primary/60 py-4">
          {/* Location heading */}
          <View className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="semibold"
              className="flex-1 text-sm text-text-primary"
            >
              Location
            </AppText>
            {onViewMap ? (
              <Pressable
                onPress={onViewMap}
                accessibilityRole="button"
                accessibilityLabel="View approved business location on map"
                className="min-h-11 cursor-pointer flex-row items-center gap-1 px-2 active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  View map
                </AppText>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={theme.extends.colors.brand}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Location map */}
          <View className="overflow-hidden rounded-xl bg-surface-secondary">
            <LocationPickerMap
              latitude={business.location.latitude}
              longitude={business.location.longitude}
              interactionEnabled={false}
              showLocationPreviewOverlay={false}
              previewHeight={156}
            />
          </View>

          {/* Bordered address and landmark card */}
          <View className="mt-3 rounded-xl border border-border-primary bg-surface p-3">
            {address.addressLine ? (
              <AppText
                weight="semibold"
                className="text-sm leading-5 text-text-primary"
              >
                {address.addressLine}
              </AppText>
            ) : null}

            {address.cityLine ? (
              <AppText
                className={`text-sm leading-5 text-text-secondary ${
                  address.addressLine ? "mt-1" : ""
                }`}
              >
                {address.cityLine}
              </AppText>
            ) : null}

            {/* Landmark count */}
            <View
              className={`flex-row items-center gap-2 ${
                address.addressLine || address.cityLine
                  ? "mt-3 border-t border-border-primary/60 pt-3"
                  : ""
              }`}
            >
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={17}
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="flex-1 text-sm text-text-secondary">
                {business.location.landmarks.length} landmark
                {business.location.landmarks.length === 1 ? "" : "s"}
              </AppText>
            </View>
          </View>
        </View>

        {/* Expandable contact details */}
        <View className="border-t border-border-primary/60 pb-4">
          {/* Contact details heading */}
          <Pressable
            onPress={() => setContactDetailsVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityState={{ expanded: contactDetailsVisible }}
            accessibilityLabel={
              contactDetailsVisible
                ? "Hide contact details"
                : "View contact details"
            }
            className="min-h-14 cursor-pointer flex-row items-center gap-2 active:opacity-70"
          >
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="semibold"
              className="flex-1 text-sm text-text-primary"
            >
              Contact details
            </AppText>

            <MaterialCommunityIcons
              name={contactDetailsVisible ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>

          {/* Bordered contact information card */}
          {contactDetailsVisible ? (
            <View className="overflow-hidden rounded-xl border border-border-primary bg-surface px-3">
              {contactDetails.map(([kind, icon, value]) => {
                const contactValue = value?.trim() ?? "";
                const hasValue = Boolean(contactValue);
                const canAdd =
                  !hasValue && canEdit && Boolean(onEditInformation);
                const isDisabled = !hasValue && !canAdd;

                function handlePress() {
                  if (hasValue) {
                    handleContactPress(kind, contactValue);
                    return;
                  }

                  if (canAdd) {
                    onEditInformation?.();
                  }
                }

                return (
                  <Pressable
                    key={kind}
                    onPress={handlePress}
                    disabled={isDisabled}
                    accessibilityRole={hasValue ? "link" : "button"}
                    accessibilityState={{ disabled: isDisabled }}
                    accessibilityLabel={
                      hasValue
                        ? `Open ${kind}: ${contactValue}`
                        : canAdd
                          ? `Add business ${kind}`
                          : `Business ${kind} not added`
                    }
                    className={`min-h-14 flex-row items-center gap-3 border-b border-border-primary/60 py-3 last:border-b-0 ${
                      isDisabled ? "" : "cursor-pointer active:opacity-70"
                    }`}
                  >
                    {/* Contact type icon */}
                    <MaterialCommunityIcons
                      name={icon}
                      size={19}
                      color={theme.extends.colors.text.secondary}
                    />

                    {/* Contact label and value */}
                    <View className="min-w-0 flex-1">
                      <AppText className="text-xs capitalize text-text-secondary">
                        {kind}
                      </AppText>

                      {hasValue ? (
                        <AppText
                          weight="medium"
                          className="mt-0.5 text-sm text-text-primary"
                          numberOfLines={2}
                        >
                          {contactValue}
                        </AppText>
                      ) : (
                        <AppText className="mt-0.5 text-sm text-text-tertiary">
                          Not added yet
                        </AppText>
                      )}
                    </View>

                    {/* Open or add action */}
                    {hasValue ? (
                      <MaterialCommunityIcons
                        name="open-in-new"
                        size={16}
                        color={theme.extends.colors.text.secondary}
                      />
                    ) : canAdd ? (
                      <View className="flex-row items-center gap-1">
                        <AppText
                          weight="semibold"
                          className="text-sm text-brand"
                        >
                          Add
                        </AppText>

                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={17}
                          color={theme.extends.colors.brand}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {/* Full-width secondary information */}
      <View className="bg-surface px-5 pb-3 pt-4">
        <AppText weight="bold" className="mb-2 text-base text-text-primary">
          More
        </AppText>

        {/* Business verification toggle */}
        <Pressable
          onPress={() => setVerificationVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityState={{ expanded: verificationVisible }}
          accessibilityLabel={
            verificationVisible
              ? "Hide business verification details"
              : "View business verification details"
          }
          className="min-h-16 cursor-pointer flex-row items-center gap-3 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={21}
            color={theme.extends.colors.text.secondary}
          />

          <View className="min-w-0 flex-1">
            <AppText weight="semibold" className="text-sm text-text-primary">
              Business verification
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

        {/* Expanded business verification information */}
        {verificationVisible ? (
          <View className="border-t border-border-primary/60 pb-4 pt-4">
            <AppText className="mb-4 text-xs leading-5 text-text-secondary">
              Information submitted during your original merchant registration.
            </AppText>

            {/* Business representative */}
            <View className="rounded-xl border border-border-primary bg-surface p-3.5">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={22}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>

                <View className="min-w-0 flex-1">
                  <AppText className="text-xs text-text-secondary">
                    Business representative
                  </AppText>

                  <AppText
                    weight="semibold"
                    className="mt-1 text-sm text-text-primary"
                  >
                    {business.verification?.representative_name ||
                      "Not provided"}
                  </AppText>
                </View>
              </View>

              {/* Representative role */}
              <View className="mt-3 flex-row items-start justify-between gap-3 border-t border-border-primary/60 pt-3">
                <AppText className="text-xs text-text-secondary">Role</AppText>

                <AppText
                  weight="medium"
                  className="min-w-0 flex-1 text-right text-sm text-text-primary"
                >
                  {business.verification?.representative_role
                    ? ROLE_LABELS[business.verification.representative_role] ||
                      business.verification.representative_role
                    : "Not provided"}
                </AppText>
              </View>
            </View>

            {/* Submitted verification documents */}
            <View className="mt-3 overflow-hidden rounded-xl border border-border-primary bg-surface">
              {/* Document section heading */}
              <View className="flex-row items-center justify-between gap-3 px-3.5 py-3">
                <View className="flex-1 flex-row items-center gap-2">
                  <MaterialCommunityIcons
                    name="file-document-multiple-outline"
                    size={20}
                    color={theme.extends.colors.text.secondary}
                  />

                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    Submitted documents
                  </AppText>
                </View>

                <View className="min-w-6 items-center justify-center rounded-full bg-background px-2 py-1">
                  <AppText
                    weight="semibold"
                    className="text-xs text-text-secondary"
                  >
                    {business.verification?.documents.length ?? 0}
                  </AppText>
                </View>
              </View>

              {/* Document list */}
              {business.verification?.documents.length ? (
                <View className="border-t border-border-primary/60 px-3.5">
                  {business.verification.documents.map((document, index) => (
                    <Pressable
                      key={document.id}
                      onPress={() => onViewDocument?.(document.id)}
                      disabled={
                        !document.file_name ||
                        document.has_file !== true ||
                        !onViewDocument ||
                        (openingDocumentId !== null &&
                          openingDocumentId !== undefined)
                      }
                      accessibilityRole={
                        document.has_file &&
                        document.file_name &&
                        onViewDocument
                          ? "button"
                          : undefined
                      }
                      accessibilityLabel={
                        document.has_file &&
                        document.file_name &&
                        onViewDocument
                          ? `Open ${DOCUMENT_LABELS[document.document_type] ?? "verification document"}: ${document.file_name}`
                          : `${DOCUMENT_LABELS[document.document_type] ?? "Verification document"}: file unavailable`
                      }
                      accessibilityState={{
                        disabled:
                          !document.file_name ||
                          document.has_file !== true ||
                          !onViewDocument ||
                          (openingDocumentId !== null &&
                            openingDocumentId !== undefined),
                        busy: openingDocumentId === document.id,
                      }}
                      className={`flex-row items-center gap-3 py-3 ${
                        index > 0 ? "border-t border-border-primary/60" : ""
                      } ${document.file_name && document.has_file && onViewDocument ? "cursor-pointer active:opacity-70" : ""}`}
                    >
                      {/* Document icon */}
                      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
                        <MaterialCommunityIcons
                          name="file-document-outline"
                          size={21}
                          color={theme.extends.colors.text.secondary}
                        />
                      </View>

                      {/* Document information */}
                      <View className="min-w-0 flex-1">
                        <AppText
                          weight="medium"
                          className="text-sm text-text-primary"
                          numberOfLines={2}
                        >
                          {DOCUMENT_LABELS[document.document_type] ??
                            "Document"}
                        </AppText>

                        {document.file_name ? (
                          <AppText
                            className="mt-1 text-xs text-text-secondary"
                            numberOfLines={2}
                          >
                            {document.file_name}
                          </AppText>
                        ) : (
                          <AppText className="mt-1 text-xs text-text-tertiary">
                            Filename unavailable
                          </AppText>
                        )}
                      </View>
                      {openingDocumentId === document.id ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.extends.colors.brand}
                        />
                      ) : document.file_name &&
                        document.has_file &&
                        onViewDocument ? (
                        <MaterialCommunityIcons
                          name="open-in-new"
                          size={17}
                          color={theme.extends.colors.text.secondary}
                        />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="items-center border-t border-border-primary/60 px-4 py-6">
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={26}
                    color={theme.extends.colors.text.tertiary}
                  />

                  <AppText className="mt-2 text-sm text-text-secondary">
                    No documents listed
                  </AppText>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Explorer mode switch */}
        {onSwitchToExplorer ? (
          <Pressable
            testID="merchant-switch-to-explorer"
            onPress={onSwitchToExplorer}
            disabled={isSwitchingToExplorer}
            accessibilityRole="button"
            accessibilityState={{
              disabled: isSwitchingToExplorer,
              busy: isSwitchingToExplorer,
            }}
            className={`min-h-14 cursor-pointer flex-row items-center gap-3 border-t border-border-primary/60 active:opacity-70 ${
              isSwitchingToExplorer ? "opacity-60" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="compass-outline"
              size={21}
              color={theme.extends.colors.text.secondary}
            />

            <AppText className="flex-1 text-sm text-text-primary">
              {isSwitchingToExplorer
                ? "Switching to Explorer..."
                : "Switch to Explorer"}
            </AppText>

            {isSwitchingToExplorer ? (
              <ActivityIndicator
                testID="merchant-switch-loading-indicator"
                size="small"
                color={theme.extends.colors.brand}
              />
            ) : (
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
