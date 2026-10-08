import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

import type { MerchantBusinessLandmark } from "../../types/merchantBusinessProfile.types";
import type { LocationChangeLocation } from "../../types/locationChange.types";
import { getLocationReviewChanges } from "../../utils/locationReview.utils";
import RegistrationSection from "../registration/RegistrationSection";
import LocationChangeComparison from "./LocationChangeComparison";

type Props = {
  currentLocation: LocationChangeLocation;
  proposedLocation: LocationChangeLocation;
  currentLandmarks: MerchantBusinessLandmark[];
  proposedLandmarks: BusinessLandmark[];
  onViewCurrent: () => void;
  onViewProposed: () => void;
};

/** Reviews only the location details changed by the merchant's draft. */
export default function LocationChangeReviewSections({
  currentLocation,
  proposedLocation,
  currentLandmarks,
  proposedLandmarks,
  onViewCurrent,
  onViewProposed,
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

  function renderMapLink() {
    return (
      <Pressable
        onPress={onViewProposed}
        accessibilityRole="button"
        accessibilityLabel="View updated landmarks on map"
        className="mt-4 min-h-12 flex-row items-center rounded-xl border border-border-primary px-3 py-2 active:bg-background"
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
          View updated landmarks on map
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
      {/* Textual address changes */}
      {addressChanges.length > 0 ? (
        <RegistrationSection
          title="Address changes"
          icon="map-marker-radius-outline"
        >
          {addressChanges.map(({ label, previous, requested }) => (
            <View
              key={label}
              className="mb-3 rounded-xl bg-background px-4 py-3 last:mb-0"
            >
              <AppText
                weight="semibold"
                className="mb-2 text-sm text-text-primary"
              >
                {label}
              </AppText>
              <View className="flex-row items-start py-1">
                <AppText className="w-20 shrink-0 text-xs text-text-secondary">
                  Current
                </AppText>
                <AppText className="min-w-0 flex-1 text-sm text-text-secondary">
                  {previous || "Not provided"}
                </AppText>
              </View>
              <View className="mt-2 flex-row items-start border-t border-border-primary/60 pt-3">
                <AppText className="w-20 shrink-0 text-xs text-text-secondary">
                  Requested
                </AppText>
                <AppText
                  weight="semibold"
                  className="min-w-0 flex-1 text-sm text-text-primary"
                >
                  {requested || "Not provided"}
                </AppText>
              </View>
            </View>
          ))}
        </RegistrationSection>
      ) : null}

      {/* Pin movement */}
      {pinMoved ? (
        <>
          <RegistrationSection
            title="New business pin"
            icon="map-marker-outline"
          >
            <LocationChangeComparison
              title="New business pin"
              location={proposedLocation}
              landmarks={proposedLandmarks}
              embedded
              onView={onViewProposed}
            />
          </RegistrationSection>

          <View className="mb-2 bg-surface">
            <Pressable
              onPress={() => setShowCurrentPin((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCurrentPin }}
              className="min-h-[60px] flex-row items-center px-6 py-3 active:bg-background"
            >
              <AppText
                weight="semibold"
                className="flex-1 text-sm text-text-primary"
              >
                Current business pin
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
                  title="Current business pin"
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

      {/* Landmark changes */}
      {landmarksChanged ? (
        <RegistrationSection
          title="Landmark changes"
          icon="map-marker-radius-outline"
        >
          {addedLandmarks.length > 0 ? (
            <View className="rounded-xl bg-background px-4 py-3">
              <AppText
                weight="semibold"
                className="mb-1 text-xs text-text-secondary"
              >
                Added ({addedLandmarks.length})
              </AppText>
              {addedLandmarks.map((landmark) => (
                <View
                  key={`added-${landmark.id}`}
                  className="flex-row items-start border-b border-border-primary/60 py-3 last:border-b-0 last:pb-0"
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
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
          {removedLandmarks.length > 0 ? (
            <View
              className={`rounded-xl bg-background px-4 py-3 ${addedLandmarks.length > 0 ? "mt-3" : ""}`}
            >
              <AppText
                weight="semibold"
                className="mb-1 text-xs text-text-secondary"
              >
                Removed ({removedLandmarks.length})
              </AppText>
              {removedLandmarks.map((landmark) => (
                <View
                  key={`removed-${landmark.id}`}
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
          {!pinMoved ? renderMapLink() : null}
        </RegistrationSection>
      ) : null}

      {/* Approval context */}
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
    </>
  );
}
