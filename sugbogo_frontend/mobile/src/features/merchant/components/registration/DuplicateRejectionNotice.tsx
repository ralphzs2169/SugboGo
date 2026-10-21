import { View } from "react-native";
import type { ReactNode } from "react";
import AppText from "@/shared/components/AppText";
import type { DuplicateDisposition } from "../../types/registration/registrationApi.types";
import RejectionCardIndicator from "./RejectionCardIndicator";

/** Explains duplicate adjudication without marking ordinary feedback sections as changed. */
export default function DuplicateRejectionNotice({
  disposition,
  children,
  showIndicator = true,
}: {
  disposition?: DuplicateDisposition | null;
  children?: ReactNode;
  showIndicator?: boolean;
}) {
  if (!disposition) return null;
  return (
    <View className="mb-3">
      <View className="relative rounded-card border border-border-primary bg-surface p-4">
        {showIndicator && <RejectionCardIndicator />}
        <AppText weight="bold" className="mb-2 text-sm text-text-primary">
          Reason: Duplicate Registration
        </AppText>
        <AppText className="text-sm leading-6 text-text-secondary">
          {disposition.explanation}
        </AppText>
        {children}
      </View>
    </View>
  );
}
