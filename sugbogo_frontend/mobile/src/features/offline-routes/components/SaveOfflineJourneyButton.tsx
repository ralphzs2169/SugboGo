import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { DirectJourneyMapGuidance } from "@/features/explore/types/directJourney.types";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

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
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (pending.current || !businessName) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await saveJourney({
        formatVersion: 1,
        savedAt: new Date().toISOString(),
        business: { id: businessId, name: businessName },
        origin,
        journey,
      });
      Toast.show({
        type: "success",
        text1: "Guidance saved",
        text2: "Find it in Profile → Offline Data.",
      });
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "Please try again.";
      setError(message);
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
    <View className="border-t border-border-primary bg-surface px-screen-x pb-3 pt-2">
      {/* Explicit device save */}
      <Button
        title="Save offline"
        variant="outline"
        size="sm"
        loading={isSaving}
        disabled={!isAuthenticated || !businessName || Platform.OS === "web"}
        onPress={handleSave}
      />
      <AppText className="mt-2 text-xs text-text-secondary">
        Saves guidance and your starting point on this device. Routes may
        change.
      </AppText>
      {error && (
        <AppText accessibilityRole="alert" className="mt-2 text-xs text-error">
          {error}
        </AppText>
      )}
    </View>
  );
}
