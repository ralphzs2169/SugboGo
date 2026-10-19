import { View } from "react-native";
import AppText from "@/shared/components/AppText";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  OVERALL_REVIEW_VIBE_STYLES,
  REVIEW_VIBE_COLORS,
} from "@/shared/constants/reviewVibe";
import type { ReviewVibe } from "@/shared/types/reviewVibe.types";

/** Displays a supplied feedback label without calculating or guessing the review vibe. */
export default function ReviewVibeBadge({
  vibe,
  testID,
}: {
  vibe?: ReviewVibe | null;
  testID?: string;
}) {
  if (!vibe || !Object.hasOwn(OVERALL_REVIEW_VIBE_STYLES, vibe)) return null;
  const style = OVERALL_REVIEW_VIBE_STYLES[vibe];
  const colors = REVIEW_VIBE_COLORS[vibe];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`Customer feedback: ${OVERALL_REVIEW_VIBE_LABELS[vibe]}`}
      className={`max-w-full flex-row items-center self-start rounded-full px-2.5 py-1 ${style.containerClassName}`}
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 1,
      }}
    >
      <View
        accessible={false}
        className="mr-2 shrink-0 rounded-full"
        style={{ width: 7, height: 7, backgroundColor: colors.dot }}
      />
      <AppText
        weight="semibold"
        className={`min-w-0 shrink text-xs ${style.textClassName}`}
        style={{ color: colors.foreground }}
      >
        {OVERALL_REVIEW_VIBE_LABELS[vibe]}
      </AppText>
    </View>
  );
}
