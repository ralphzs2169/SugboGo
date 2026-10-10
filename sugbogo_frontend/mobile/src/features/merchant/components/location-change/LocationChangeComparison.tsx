import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import LocationPickerMap from "../registration/location/LocationPickerMap";
import type { LocationChangeLocation } from "../../types/locationChange.types";

type DisplayLandmark = {
  name: string;
  address: string;
};

type LocationChangeComparisonProps = {
  title: string;
  location: LocationChangeLocation;
  landmarks: DisplayLandmark[];
  onView: () => void;
  compact?: boolean;
  embedded?: boolean;
};

/**
 * Displays a read-only location snapshot with its address, optional map
 * preview, full-map navigation, and expandable technical coordinates.
 *
 * Supports standalone and embedded layouts to avoid nested cards
 * when displayed inside an accordion.
 */
export default function LocationChangeComparison({
  title,
  location,
  landmarks,
  onView,
  compact = false,
  embedded = false,
}: LocationChangeComparisonProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <View
      className={
        embedded
          ? ""
          : "rounded-card border border-border-primary bg-surface p-4"
      }
    >
      {/* Location heading */}
      {!embedded ? (
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={21}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="bold"
            className="ml-2 flex-1 text-base text-text-primary"
          >
            {title}
          </AppText>
        </View>
      ) : null}

      {/* Address details */}
      <View
        className={`rounded-xl bg-background p-3 ${embedded ? "" : "mt-3"}`}
      >
        <AppText
          weight="semibold"
          className="text-sm leading-5 text-text-primary"
        >
          {location.address}
        </AppText>

        <AppText className="mt-1 text-xs text-text-secondary">
          {location.city}, {location.province}
          {location.postal_code ? ` ${location.postal_code}` : ""}
        </AppText>
      </View>

      {/* Read-only map preview */}
      {!compact ? (
        <View className="mt-3 overflow-hidden rounded-2xl">
          <LocationPickerMap
            latitude={location.latitude}
            longitude={location.longitude}
            interactionEnabled={false}
            showLocationPreviewOverlay={false}
            previewHeight={192}
          />
        </View>
      ) : null}

      {/* Fullscreen map navigation */}
      <Pressable
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`View full map for ${title.toLowerCase()}`}
        className="mt-3 min-h-14 cursor-pointer flex-row items-center rounded-xl border border-border-primary bg-surface px-3.5 py-3 active:bg-surface-secondary"
      >
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-background">
          <MaterialCommunityIcons
            name="map-outline"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            View full map
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {landmarks.length === 0
              ? "No landmarks added"
              : `${landmarks.length} landmark${
                  landmarks.length === 1 ? "" : "s"
                }`}
          </AppText>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {/* Technical coordinates */}
      <Pressable
        onPress={() => setShowTechnicalDetails((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showTechnicalDetails }}
        className="mt-2 min-h-11 cursor-pointer flex-row items-center justify-between py-2 active:opacity-70"
      >
        <AppText className="text-xs text-text-secondary">
          Technical details
        </AppText>

        <MaterialCommunityIcons
          name={showTechnicalDetails ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {showTechnicalDetails ? (
        <AppText className="text-xs text-text-secondary">
          Pin: {location.latitude}, {location.longitude}
        </AppText>
      ) : null}
    </View>
  );
}
