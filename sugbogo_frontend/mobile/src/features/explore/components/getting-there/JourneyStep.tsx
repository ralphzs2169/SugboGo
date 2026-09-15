import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  number: number;
  title: string;
  detail: string;
  supportingText?: string;
  isLast?: boolean;
};

/**
 * Renders one readable stage in a direct jeepney journey timeline.
 */
export default function JourneyStep({
  number,
  title,
  detail,
  supportingText,
  isLast = false,
}: Props) {
  return (
    <View className="flex-row">
      {/* Step marker */}
      <View className="items-center">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <AppText weight="bold" className="text-sm text-brand">
            {number}
          </AppText>
        </View>

        {!isLast && <View className="min-h-7 w-px flex-1 bg-border-primary" />}
      </View>

      {/* Step guidance */}
      <View className={`ml-3 flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
        <AppText weight="bold" className="text-base text-text-primary">
          {title}
        </AppText>

        <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
          {detail}
        </AppText>

        {supportingText ? (
          <AppText
            weight="semibold"
            className="mt-1 text-sm leading-5 text-brand"
          >
            {supportingText}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
