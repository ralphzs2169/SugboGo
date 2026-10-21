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
        Duplicate registration review
      </AppText>
      <AppText className="text-sm leading-6 text-text-secondary">
        {disposition.explanation}
      </AppText>
      <AppText className="mt-2 text-sm leading-6 text-text-secondary">
        {disposition.reconsidered
          ? "An administrator has reconsidered this decision. You may resubmit without changing accurate business details. Any ordinary section corrections still apply."
          : "Administrator reconsideration is required before resubmission. You do not need to change accurate business details to challenge this classification. Contact SugboGo support to request reconsideration."}
      </AppText>
      {disposition.reconsideration_explanation && (
        <AppText className="mt-2 text-sm text-text-secondary">
          {disposition.reconsideration_explanation}
        </AppText>
      )}
    </View>
  );
}
