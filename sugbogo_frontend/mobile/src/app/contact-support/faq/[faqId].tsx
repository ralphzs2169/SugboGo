import { Stack, useLocalSearchParams } from "expo-router";

import { getSupportFaq } from "@/features/support/constants/supportFaqDraft";
import FaqDetailScreen from "@/features/support/screens/FaqDetailScreen";
import AppText from "@/shared/components/AppText";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

/** Opens one public FAQ using its identifier without changing the Help Center list. */
export default function FaqDetailRoute() {
  const { faqId } = useLocalSearchParams<{ faqId?: string | string[] }>();
  const faq = getSupportFaq(faqId);
  const title = faq?.question ?? "FAQ unavailable";

  return (
    <>
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title,
          headerTitle: () => (
            <AppText
              accessibilityRole="header"
              accessibilityLabel={title}
              weight="bold"
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-base text-text-primary"
            >
              {title}
            </AppText>
          ),
        }}
      />
      <FaqDetailScreen key={faq?.id ?? "unavailable"} faq={faq} />
    </>
  );
}
