import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import RegistrationSection from "../registration/RegistrationSection";
import type { BusinessNameChangeStatus } from "../../types/businessNameChange.types";

type Props = {
  previousName: string;
  proposedName: string;
  status?: BusinessNameChangeStatus;
  presentation?: "section" | "card";
};

/** Shows the original and requested business names with a clear change direction. */
export default function BusinessNameChangeComparison({
  previousName,
  proposedName,
  status,
  presentation = "section",
}: Props) {
  const previousLabel = status ? "At submission" : "Currently live";
  const proposedLabel =
    status === "approved" ? "Approved" : status ? "Requested" : "Proposed";

  const content = (
    <View>
      {/* Original name */}
      <AppText className="text-xs text-text-secondary">{previousLabel}</AppText>
      <AppText
        weight="semibold"
        className="mt-1 text-base leading-6 text-text-secondary"
      >
        {previousName}
      </AppText>

      {/* Change direction */}
      <View className="my-4 flex-row items-center gap-3">
        <View className="h-8 w-10 items-center justify-center">
          <MaterialCommunityIcons
            name="arrow-down"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </View>
        <View className="h-px flex-1 bg-border-primary" />
      </View>

      {/* Requested name */}
      <AppText className="text-xs text-text-secondary">{proposedLabel}</AppText>
      <AppText
        weight="bold"
        className="mt-1 text-base leading-6 text-text-primary"
      >
        {proposedName}
      </AppText>
    </View>
  );

  if (presentation === "card") {
    return (
      <View className="mb-4 rounded-2xl border border-border-primary/70 bg-surface p-4">
        <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
          <AppText weight="bold" className="text-sm text-text-primary">
            Business name change
          </AppText>
          <MaterialCommunityIcons
            name="store-edit-outline"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </View>
        <View className="pt-4">{content}</View>
      </View>
    );
  }

  return (
    <RegistrationSection title="Business name change" icon="store-edit-outline">
      {content}
    </RegistrationSection>
  );
}
