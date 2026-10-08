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

type Props = {
  currentLocation: LocationChangeLocation;
  proposedLocation: LocationChangeLocation;
  currentLandmarks: (MerchantBusinessLandmark | LocationChangeLandmark)[];
  proposedLandmarks: (BusinessLandmark | LocationChangeLandmark)[];
  onViewCurrent: () => void;
  onViewProposed: () => void;
  status?: LocationChangeStatus;
};

/**
 * Displays only changed address, pin, and landmark details in a location request.
 *
 * Uses before-and-after address comparisons, expandable map details,
 * and separate landmark additions and removals to support review
 * before submission.
 */
export default function LocationChangeReviewSections({
  currentLocation,
  proposedLocation,
  currentLandmarks,
  proposedLandmarks,
  onViewCurrent,
  onViewProposed,
  status,
}: Props) {
  const [showCurrentPin, setShowCurrentPin] = useState(false);

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

  return (
    <>
      {/* Address before-and-after comparisons */}
      {addressChanges.length > 0 ? (
        <RegistrationSection
          title="Address changes"
          icon="map-marker-radius-outline"
        >
          <View className="gap-3">
            {addressChanges.map(({ label, previous, requested }) => (
              <View
                key={label}
                className="rounded-xl border border-border-primary/70 bg-surface p-4"
              >
                {/* Address field heading */}
                <AppText
                  weight="semibold"
                  className="mb-4 text-sm text-text-primary"
                >
                  {label}
                </AppText>

                {/* Currently live value */}
                <View>
                  <AppText className="text-xs text-text-secondary">
                    {currentLabel}
                  </AppText>

                  <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                    {previous || "Not provided"}
                  </AppText>
                </View>

                {/* Change direction */}
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

                {/* Proposed value */}
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
        </RegistrationSection>
      ) : null}

      {/* Proposed map pin */}
      {pinMoved ? (
        <>
          <RegistrationSection
            title={requestedPinTitle}
            icon="map-marker-outline"
          >
            <LocationChangeComparison
              title={requestedPinTitle}
              location={proposedLocation}
              landmarks={proposedLandmarks}
              embedded
              onView={onViewProposed}
            />
          </RegistrationSection>

          {/* Expandable original map pin */}
          <View className="mb-2 bg-surface">
            <Pressable
              onPress={() => setShowCurrentPin((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={
                status ? "Business pin at submission" : "Current business pin"
              }
              accessibilityState={{ expanded: showCurrentPin }}
              className="min-h-[60px] cursor-pointer flex-row items-center px-6 py-3 active:bg-background"
            >
              <AppText
                weight="semibold"
                className="flex-1 text-sm text-text-primary"
              >
                {status ? "Business pin at submission" : "Current business pin"}
              </AppText>

              <MaterialCommunityIcons
                name={showCurrentPin ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>

            {showCurrentPin ? (
              <View className="border-t border-border-primary px-6 pb-4 pt-3">
                <LocationChangeComparison
                  title={
                    status
                      ? "Business pin at submission"
                      : "Current business pin"
                  }
                  location={currentLocation}
                  landmarks={currentLandmarks}
                  compact
                  embedded
                  onView={onViewCurrent}
                />
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {/* Landmark additions and removals */}
      {landmarksChanged ? (
        <RegistrationSection
          title="Landmark changes"
          icon="map-marker-radius-outline"
        >
          {/* Landmarks to be added */}
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

          {/* Landmarks to be removed */}
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

          {/* Map preview for landmark-only changes */}
          {!pinMoved ? renderMapLink() : null}
        </RegistrationSection>
      ) : null}

      {/* Approval context */}
      {!status ? (
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
