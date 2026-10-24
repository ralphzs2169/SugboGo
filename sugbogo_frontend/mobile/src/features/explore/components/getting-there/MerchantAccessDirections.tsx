import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = { directions?: string | null };

/** Shows optional merchant instructions independently of computed route results. */
export default function MerchantAccessDirections({ directions }: Props) {
  const text = directions?.trim();
  if (!text) return null;

  return (
    <View className="my-4 rounded-xl border border-border-primary bg-surface-secondary p-4">
      {/* Merchant attribution stays distinct from computed guidance. */}
      <AppText weight="semibold" className="text-base text-text-primary">
        How to reach us
      </AppText>
      <AppText className="mt-1 text-xs text-text-secondary">
        Merchant-provided directions
      </AppText>
      <AppText className="mt-3 text-sm leading-5 text-text-primary">
        {text}
      </AppText>
    </View>
  );
}
