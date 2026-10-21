import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import type { DuplicateDisposition } from "../../types/registration/registrationApi.types";

/** Explains duplicate adjudication without marking ordinary feedback sections as changed. */
export default function DuplicateRejectionNotice({
  disposition,
}: {
  disposition?: DuplicateDisposition | null;
}) {
  if (!disposition) return null;
  return (
    <View className="mb-3">
      <View className="rounded-card border border-border-primary bg-surface p-4">
        <AppText weight="bold" className="mb-2 text-sm text-text-primary">
          Reason: Duplicate Registration
        </AppText>
        <AppText className="text-sm leading-6 text-text-secondary">
          {disposition.explanation}
        </AppText>
      </View>
    </View>
  );
}
