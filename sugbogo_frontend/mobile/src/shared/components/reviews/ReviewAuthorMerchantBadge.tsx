import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  role?: string;
};

/** Identifies merchant reviewers without implying endorsement or a conflict. */
export default function ReviewAuthorMerchantBadge({ role }: Props) {
  if (role !== "merchant") {
    return null;
  }

  return (
    <View className="max-w-full rounded-full bg-surface-muted px-2 py-0.5">
      <AppText
        accessibilityLabel="Reviewer has a merchant account on SugboGo"
        weight="medium"
        className="text-small text-text-secondary"
      >
        Merchant
      </AppText>
    </View>
  );
}
