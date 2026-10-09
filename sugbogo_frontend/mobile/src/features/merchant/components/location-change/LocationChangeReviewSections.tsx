import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

import type { MerchantBusinessLandmark } from "../../types/merchantBusinessProfile.types";
import type {
  LocationChangeLandmark,
  LocationChangeLocation,
  LocationChangeStatus,
} from "../../types/locationChange.types";
import { getLocationReviewChanges } from "../../utils/locationReview.utils";
import RegistrationSection from "../registration/RegistrationSection";
import LocationChangeComparison from "./LocationChangeComparison";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type LocationChangePresentation = "review" | "detail";

type Props = {
  currentLocation: LocationChangeLocation;
  proposedLocation: LocationChangeLocation;
  currentLandmarks: (MerchantBusinessLandmark | LocationChangeLandmark)[];
  proposedLandmarks: (BusinessLandmark | LocationChangeLandmark)[];
  onViewCurrent: () => void;
  onViewProposed: () => void;
  status?: LocationChangeStatus;
  showApprovalContext?: boolean;
  variant?: LocationChangePresentation;
};

type ChangeSectionProps = {
  title: string;
  icon: IconName;
  variant: LocationChangePresentation;
  children: React.ReactNode;
};

/**
 * Presents a location change section using the appropriate screen layout.
 *
 * Preserves registration-style sections during review and uses compact
 * bordered cards when displaying an existing request's details.
 */
function ChangeSection({ title, icon, variant, children }: ChangeSectionProps) {
  if (variant === "review") {
    return (
      <RegistrationSection title={title} icon={icon}>
        {children}
      </RegistrationSection>
    );
  }

  return (
    <View className="mb-3 rounded-2xl border border-border-primary/70 bg-surface p-4">
      {/* Detail card heading */}
      <View className="mb-4 flex-row items-center gap-2 border-b border-border-primary/60 pb-3">
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={theme.extends.colors.text.secondary}
        />

        <AppText
          weight="semibold"
          className="min-w-0 flex-1 text-sm text-text-primary"
        >
          {title}
        </AppText>
      </View>

      {/* Section contents */}
      {children}
    </View>
  );
}

/**
 * Displays changed address fields, business pin, and landmarks.
 *
 * Uses registration-style sections before submission and bordered cards for
 * submitted request details. Keeps changed-field detection, map navigation,
 * approval-aware labels, and the expandable original business pin.
 */
export default function LocationChangeReviewSections({
  currentLocation,
  proposedLocation,
  currentLandmarks,
  proposedLandmarks,
  onViewCurrent,
  onViewProposed,
  status,
  showApprovalContext = true,
  variant = "review",
}: Props) {
  const [showCurrentPin, setShowCurrentPin] = useState(false);

  const isDetail = variant === "detail";

  const { addressChanges, pinMoved, addedLandmarks, removedLandmarks } =
    getLocationReviewChanges(
      currentLocation,
      proposedLocation,
      currentLandmarks,
      proposedLandmarks,
    );

  const landmarksChanged =
    addedLandmarks.length > 0 || removedLandmarks.length > 0;

  const currentLabel = status ? "At submission" : "Currently live";

  const proposedLabel =
    status === "approved" ? "Approved" : status ? "Requested" : "Proposed";

  const requestedPinTitle =
    status === "approved"
      ? "Approved business pin"
      : status
        ? "Requested business pin"
        : "New business pin";

  const addedLabel =
    status === "approved"
      ? "Added"
      : status
        ? "Requested to add"
        : "To be added";

  const removedLabel =
    status === "approved"
      ? "Removed"
      : status
        ? "Requested to remove"
        : "To be removed";

  const mapLinkLabel =
    status === "approved"
      ? "View approved landmarks on map"
      : status
        ? "View requested landmarks on map"
        : "View updated landmarks on map";

  const originalPinLabel = status
    ? "Business pin at submission"
    : "Current business pin";

  function renderMapLink() {
    return (
      <Pressable
        onPress={onViewProposed}
        accessibilityRole="button"
        accessibilityLabel={mapLinkLabel}
        className="mt-4 min-h-12 cursor-pointer flex-row items-center rounded-xl border border-border-primary px-3 py-2 active:bg-background"
      >
        <MaterialCommunityIcons
          name="map-outline"
          size={20}
          color={theme.extends.colors.text.secondary}
        />

        <AppText
          weight="semibold"
          className="ml-3 flex-1 text-sm text-text-primary"
        >
          {mapLinkLabel}
        </AppText>

        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>
    );
  }

  function renderOriginalPin() {
    return (
      <View
        className={
          isDetail
            ? "mt-4 border-t border-border-primary/60"
            : "mb-2 bg-surface"
        }
      >
        {/* Expandable original pin heading */}
        <Pressable
          onPress={() => setShowCurrentPin((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={originalPinLabel}
          accessibilityState={{ expanded: showCurrentPin }}
          className={`min-h-12 cursor-pointer flex-row items-center active:bg-background ${
            isDetail ? "py-3" : "min-h-[60px] px-6 py-3"
          }`}
        >
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="semibold"
            className="ml-2 min-w-0 flex-1 text-sm text-text-primary"
          >
            {originalPinLabel}
          </AppText>

          <MaterialCommunityIcons
            name={showCurrentPin ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>

        {/* Original map pin comparison */}
        {showCurrentPin ? (
          <View
            className={
              isDetail
                ? "border-t border-border-primary/60 pt-3"
                : "border-t border-border-primary px-6 pb-4 pt-3"
            }
          >
            <LocationChangeComparison
              title={originalPinLabel}
              location={currentLocation}
              landmarks={currentLandmarks}
              compact
              embedded
              onView={onViewCurrent}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {/* Address before-and-after comparisons */}
      {addressChanges.length > 0 ? (
        <ChangeSection
          title="Address changes"
          icon="map-marker-radius-outline"
          variant={variant}
        >
          <View className={isDetail ? "" : "gap-3"}>
            {addressChanges.map(({ label, previous, requested }, index) => (
              <View
                key={label}
                className={
                  isDetail
                    ? index > 0
                      ? "mt-4 border-t border-border-primary/60 pt-4"
                      : ""
                    : "rounded-xl border border-border-primary/70 bg-surface p-4"
                }
              >
                {/* Changed address field */}
                <AppText
                  weight="semibold"
                  className="mb-4 text-sm text-text-primary"
                >
                  {label}
                </AppText>

                {/* Original address value */}
                <View>
                  <AppText className="text-xs text-text-secondary">
                    {currentLabel}
                  </AppText>

                  <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                    {previous || "Not provided"}
                  </AppText>
                </View>

                {/* Direction of change */}
                <View className="my-3 flex-row items-center gap-3">
                  <View className="h-8 w-10 items-center justify-center">
                    <MaterialCommunityIcons
                      name="arrow-down"
                      size={20}
                      color={theme.extends.colors.text.secondary}
                    />
                  </View>

                  <View className="h-px flex-1 bg-border-primary" />
                </View>

                {/* Requested or approved address value */}
                <View>
                  <AppText className="text-xs text-text-secondary">
                    {proposedLabel}
                  </AppText>

                  <AppText
                    weight="semibold"
                    className="mt-1 text-sm leading-5 text-text-primary"
                  >
                    {requested || "Not provided"}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </ChangeSection>
      ) : null}

      {/* Business pin comparison */}
      {pinMoved ? (
        <>
          <ChangeSection
            title={requestedPinTitle}
            icon="map-marker-outline"
            variant={variant}
          >
            {/* Requested or approved map pin */}
            <LocationChangeComparison
              title={requestedPinTitle}
              location={proposedLocation}
              landmarks={proposedLandmarks}
              embedded
              onView={onViewProposed}
            />

            {/* Original pin stays inside the detail card */}
            {isDetail ? renderOriginalPin() : null}
          </ChangeSection>

          {/* Registration review retains its separate original pin */}
          {!isDetail ? renderOriginalPin() : null}
        </>
      ) : null}

      {/* Landmark additions and removals */}
      {landmarksChanged ? (
        <ChangeSection
          title="Landmark changes"
          icon="map-marker-radius-outline"
          variant={variant}
        >
          {/* Added landmarks */}
          {addedLandmarks.length > 0 ? (
            <View className="rounded-xl bg-background px-4 py-3">
              <AppText
                weight="semibold"
                className="mb-1 text-xs text-text-secondary"
              >
                {addedLabel} ({addedLandmarks.length})
              </AppText>

              {addedLandmarks.map((landmark, index) => (
                <View
                  key={`added-${landmark.id ?? index}`}
                  className="flex-row items-start border-b border-border-primary/60 py-3 last:border-b-0 last:pb-0"
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={20}
                    color={theme.extends.colors.text.info}
                  />

                  <View className="ml-3 min-w-0 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {landmark.name}
                    </AppText>

                    {landmark.address ? (
                      <AppText className="mt-0.5 text-xs text-text-secondary">
                        {landmark.address}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Removed landmarks */}
          {removedLandmarks.length > 0 ? (
            <View
              className={`rounded-xl bg-background px-4 py-3 ${
                addedLandmarks.length > 0 ? "mt-3" : ""
              }`}
            >
              <AppText
                weight="semibold"
                className="mb-1 text-xs text-text-secondary"
              >
                {removedLabel} ({removedLandmarks.length})
              </AppText>

              {removedLandmarks.map((landmark, index) => (
                <View
                  key={`removed-${landmark.id ?? index}`}
                  className="flex-row items-start border-b border-border-primary/60 py-3 last:border-b-0 last:pb-0"
                >
                  <MaterialCommunityIcons
                    name="minus-circle-outline"
                    size={20}
                    color={theme.extends.colors.text.secondary}
                  />

                  <View className="ml-3 min-w-0 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {landmark.name}
                    </AppText>

                    {landmark.address ? (
                      <AppText className="mt-0.5 text-xs text-text-secondary">
                        {landmark.address}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Map action for landmark-only changes */}
          {!pinMoved ? renderMapLink() : null}
        </ChangeSection>
      ) : null}

      {/* Pre-submission approval explanation */}
      {!isDetail && !status && showApprovalContext ? (
        <View className="mt-3 flex-row items-start px-6">
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />

          <AppText className="ml-2 flex-1 text-xs leading-5 text-text-secondary">
            Your current business location and landmarks will remain live until
            this request is approved.
          </AppText>
        </View>
      ) : null}
    </>
  );
}
