import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";
import type { BusinessNameChangeRequest } from "../../types/businessNameChange.types";

import BusinessNameChangeStatusBadge from "./BusinessNameChangeStatusBadge";

/** Summarizes a historical name proposal without presenting it as live data. */
export default function BusinessNameChangeRequestCard({
  request,
  onPress,
}: {
  request: BusinessNameChangeRequest;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View business name request for ${request.proposed_business_name}`}
      className="rounded-card border border-border-primary bg-surface p-4 active:opacity-75"
    >
      {/* Request identity and status */}
      <View className="flex-row items-start justify-between gap-3">
        <AppText weight="bold" className="flex-1 text-base text-text-primary">
          Business Name
        </AppText>
        <BusinessNameChangeStatusBadge status={request.status} />
      </View>
      <AppText className="mt-3 text-xs text-text-secondary">Requested</AppText>
      <AppText weight="semibold" className="mt-1 text-sm text-text-primary">
        {request.proposed_business_name}
      </AppText>
      {request.status === "rejected" && request.rejection_reason ? (
        <AppText className="mt-2 text-sm text-text-error">
          Reason: {request.rejection_reason}
        </AppText>
      ) : null}

      {/* Submission metadata */}
      <View className="mt-4 flex-row items-center justify-between border-t border-border-primary pt-3">
        <AppText className="text-xs text-text-secondary">
          Submitted {formatDate(request.submitted_at)}
        </AppText>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.tertiary}
        />
      </View>
    </Pressable>
  );
}
