import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";

import type { BusinessNameChangeRequest } from "../../types/businessNameChange.types";
import BusinessNameChangeStatusBadge from "./BusinessNameChangeStatusBadge";

/**
 * Displays a historical business name change request.
 *
 * Highlights the previous and requested names when both are available,
 * while keeping the request status, identifier, and submission date
 * consistent with other merchant change request history cards.
 */
export default function BusinessNameChangeRequestCard({
  request,
  onPress,
}: {
  request: BusinessNameChangeRequest;
  onPress: () => void;
}) {
  const previousName =
    "previous_business_name" in request &&
    typeof request.previous_business_name === "string"
      ? request.previous_business_name
      : null;

  const proposedName = request.proposed_business_name;

  const showComparison =
    previousName !== null && previousName.trim() !== proposedName.trim();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View business name change request ${request.id}`}
      className="cursor-pointer rounded-2xl border border-border-primary/70 bg-surface p-4 active:opacity-75"
    >
      {/* Request identifier and status */}
      <View className="flex-row items-center justify-between gap-3 border-b border-border-primary/60 pb-3">
        <AppText
          weight="semibold"
          className="text-xs tracking-wide text-text-secondary"
        >
          REQUEST #{request.id}
        </AppText>

        <BusinessNameChangeStatusBadge status={request.status} />
      </View>

      {/* Business name change summary */}
      <View className="flex-row items-start gap-3 py-4">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name="storefront-outline"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Business name change
          </AppText>

          {showComparison ? (
            <View className="mt-3">
              {/* Name at the time of submission */}
              <View>
                <AppText className="text-xs text-text-secondary">
                  Previous name
                </AppText>

                <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                  {previousName}
                </AppText>
              </View>

              {/* Name change direction */}
              <View className="my-2 flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="arrow-down"
                  size={18}
                  color={theme.extends.colors.text.tertiary}
                />

                <View className="h-px flex-1 bg-border-primary/60" />
              </View>

              {/* Requested business name */}
              <View>
                <AppText className="text-xs text-text-secondary">
                  Requested name
                </AppText>

                <AppText
                  weight="semibold"
                  className="mt-1 text-sm leading-5 text-text-primary"
                >
                  {proposedName}
                </AppText>
              </View>
            </View>
          ) : (
            <View className="mt-2">
              <AppText className="text-xs text-text-secondary">
                Requested name
              </AppText>

              <AppText
                weight="semibold"
                className="mt-1 text-sm leading-5 text-text-primary"
              >
                {proposedName}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* Submission metadata */}
      <View className="flex-row items-center justify-between border-t border-border-primary/60 pt-3">
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
