import { useRef, useState } from "react";
import { ActivityIndicator, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { reverseGeocodeJourneyOrigin } from "@/features/explore/api/journeyOrigin.service";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { onlineManager } from "@tanstack/react-query";
import type { DirectJourneyMapGuidance } from "@/features/explore/types/directJourney.types";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import { saveJourney } from "../services/savedJourneys.service";

type Props = {
  businessId: number;
  businessName: string | null;
  journey: DirectJourneyMapGuidance;
  origin: { latitude: number; longitude: number; label: string };
};

/** Saves a loaded journey explicitly, with pending feedback and device-storage disclosure. */
export default function SaveOfflineJourneyButton({
  businessId,
  businessName,
  journey,
  origin,
}: Props) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pending = useRef(false);
  const [isSaving, setSaving] = useState(false);
  const [isSaved, setSaved] = useState(false);

  async function handleSave() {
    if (pending.current || isSaved || !businessName) return;
    pending.current = true;
    setSaving(true);
    const ownerId = useAuthStore.getState().user?.id;
    const generation = getAuthSessionGeneration();
    try {
      const savedOrigin = { ...origin };
      if (
        ["Current location", "Selected map location"].includes(
          origin.label.trim(),
        )
      ) {
        savedOrigin.label = `${origin.latitude.toFixed(5)}, ${origin.longitude.toFixed(5)}`;
        if (onlineManager.isOnline()) {
          try {
            const response = await reverseGeocodeJourneyOrigin(
              origin.latitude,
              origin.longitude,
            );
            if (
              response.success &&
              response.data.address.formattedAddress.trim()
            ) {
              savedOrigin.label = response.data.address.formattedAddress
                .trim()
                .slice(0, 500);
            }
          } catch {
            // Address lookup must not prevent saving usable coordinate-based guidance.
          }
        }
      }
      const session = useAuthStore.getState();
      if (
        !isAuthSessionGenerationCurrent(generation) ||
        !session.isAuthenticated ||
        session.isLoading ||
        session.user?.id !== ownerId
      ) {
        return;
      }
      await saveJourney({
        formatVersion: 1,
        savedAt: new Date().toISOString(),
        business: { id: businessId, name: businessName },
        origin: savedOrigin,
        journey,
      });
      if (!isAuthSessionGenerationCurrent(generation)) return;
      setSaved(true);
      Toast.show({
        type: "success",
        text1: "Guidance saved",
        text2: "Find it in Offline Storage → Saved journeys.",
      });
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "Please try again.";
      Toast.show({
        type: "error",
        text1: "Unable to save guidance",
        text2: message,
      });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={
        isSaved ? "Journey saved offline" : "Save journey offline"
      }
      accessibilityState={{
        disabled:
          isSaving ||
          isSaved ||
          !isAuthenticated ||
          !businessName ||
          Platform.OS === "web",
        busy: isSaving,
      }}
      className="min-h-12 min-w-12 flex-row items-center justify-center gap-1.5 rounded-full px-3 active:bg-surface-muted disabled:opacity-60"
      disabled={
        isSaving ||
        isSaved ||
        !isAuthenticated ||
        !businessName ||
        Platform.OS === "web"
      }
      onPress={handleSave}
    >
      {isSaving ? (
        <ActivityIndicator size="small" color={theme.extends.colors.brand} />
      ) : (
        <MaterialCommunityIcons
          name={isSaved ? "check" : "download-outline"}
          size={18}
          color={theme.extends.colors.brand}
          accessible={false}
        />
      )}
      <AppText weight="semibold" className="text-xs text-brand">
        {isSaving ? "Saving" : isSaved ? "Saved" : "Save"}
      </AppText>
    </SafePressable>
  );
}
