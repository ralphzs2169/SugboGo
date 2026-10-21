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
    <View className="my-4 rounded-md border border-border-primary bg-surface p-4">
      <AppText weight="bold" className="mb-2 text-sm text-text-primary">
        Reason: Duplicate Registration
      </AppText>
      <AppText className="text-sm leading-6 text-text-secondary">
        {disposition.explanation}
      </AppText>
      <AppText className="mt-2 text-sm leading-6 text-text-secondary">
        Please verify your business details. You may review and resubmit your
        application without changing accurate information. Another administrator
        review will be required. Any required section corrections must be
        completed.
      </AppText>
    </View>
  );
}
