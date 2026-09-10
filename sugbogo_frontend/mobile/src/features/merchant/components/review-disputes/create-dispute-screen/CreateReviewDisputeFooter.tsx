import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type Props = {
  isSubmitting: boolean;
  onSubmit: () => void;
};

/**
 * Displays the persistent submission action for the dispute creation flow.
 *
 * Applies the device bottom inset directly so the action remains above system
 * navigation controls without relying on the surrounding screen layout.
 */
export default function CreateReviewDisputeFooter({
  isSubmitting,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-border-primary bg-surface px-4 pt-3"
      style={{
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {/* Submit action */}
      <Button
        title="Submit dispute"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}
        rounded="full"
        fontClassName="font-bold"
      />

      {/* Submission guidance */}
      <AppText className="mt-2 text-center text-xs leading-4 text-text-secondary">
        Your dispute will be reviewed by a SugboGo administrator.
      </AppText>
    </View>
  );
}
