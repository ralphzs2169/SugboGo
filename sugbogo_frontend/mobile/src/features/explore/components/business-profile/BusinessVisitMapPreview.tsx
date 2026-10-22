import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { Platform, View } from "react-native";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { ExploreBusinessLocation } from "../../types/exploreBusiness.types";
import BusinessLocationMap from "./BusinessLocationMap";

type Props = {
  location: ExploreBusinessLocation;
  readOnly: boolean;
  businessId?: number;
};

/** Opens the transportation hub when the map preview is available. */
export default function BusinessVisitMapPreview({
  location,
  readOnly,
  businessId,
}: Props) {
  const { latitude, longitude } = location;
  const validCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const showMap = !readOnly && validCoordinates && Platform.OS !== "web";
  const canOpen =
    showMap && Number.isSafeInteger(businessId) && (businessId ?? 0) > 0;
  const active = useRef(false);
  const generation = getAuthSessionGeneration();
  const ownerId = useAuthStore.getState().user?.id;
  useLayoutEffect(() => {
    active.current = canOpen;
    return () => {
      active.current = false;
    };
  }, [canOpen]);

  return (
    <SafePressable
      testID="business-visit-map-preview"
      accessibilityRole="button"
      accessibilityLabel={
        readOnly
          ? "Getting there unavailable offline"
          : "Getting there: choose a route or ride"
      }
      accessibilityState={{ disabled: !canOpen }}
      disabled={!canOpen}
      onPress={() => {
        const auth = useAuthStore.getState();
        if (
          !active.current ||
          !onlineManager.isOnline() ||
          !auth.isAuthenticated ||
          auth.isLoading ||
          auth.user?.id !== ownerId ||
          getAuthSessionGeneration() !== generation
        ) {
          return;
        }
        router.push({
          pathname: "/(explorer)/business/[businessId]/getting-there",
          params: { businessId: String(businessId) },
        });
      }}
      className="mt-4 overflow-hidden rounded-card border border-border-primary bg-surface active:opacity-90"
    >
      <View style={{ height: 150 }} className="bg-surface-secondary">
        {showMap ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-1"
          >
            <BusinessLocationMap location={location} />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-2 px-4">
            <MaterialCommunityIcons
              name="map-outline"
              size={27}
              color={theme.extends.colors.text.tertiary}
              accessible={false}
            />
            <AppText className="text-center text-sm text-text-secondary">
              {readOnly ? "Map needs a connection" : "Map unavailable"}
            </AppText>
          </View>
        )}
      </View>
    </SafePressable>
  );
}
