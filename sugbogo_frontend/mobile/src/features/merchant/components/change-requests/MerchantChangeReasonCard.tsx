import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FormTextArea from "@/shared/components/form/FormTextArea";
import RegistrationSection from "../registration/RegistrationSection";

type Props = {
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  error?: string;
};

/** Shows the merchant's reason in review mode or as a submitted read-only detail. */
export default function MerchantChangeReasonCard({
  value,
  onChangeText,
  placeholder,
  error,
}: Props) {
  const editable = Boolean(onChangeText);

  if (editable) {
    return (
      <RegistrationSection
        title="Reason for change"
        icon="text-box-edit-outline"
      >
        <FormTextArea
          label="Briefly explain why you're requesting this update."
          required
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          minLength={10}
          showCharacterCount
          maxLength={500}
          error={error}
          accessibilityLabel="Reason for change"
        />
      </RegistrationSection>
    );
  }

  return (
    <View className="rounded-2xl border border-border-primary/70 bg-surface p-4">
      {/* Section heading */}
      <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
        <AppText weight="semibold" className="text-sm text-text-primary">
          Reason for change
        </AppText>
        <MaterialCommunityIcons
          name="text-box-edit-outline"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </View>

      {/* Merchant explanation */}
      <View className="pt-4">
        <AppText
          weight="semibold"
          className="text-xs uppercase tracking-wide text-text-secondary"
        >
          Your explanation
        </AppText>
        <View className="mt-2 overflow-hidden rounded-xl bg-background">
          <View className="flex-row">
            <View className="w-1 bg-brand" />
            <View className="flex-1 px-4 py-4">
              <MaterialCommunityIcons
                name="format-quote-open"
                size={20}
                color={theme.extends.colors.text.tertiary}
              />
              <AppText className="mt-1 text-sm leading-6 text-text-primary">
                {value}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
