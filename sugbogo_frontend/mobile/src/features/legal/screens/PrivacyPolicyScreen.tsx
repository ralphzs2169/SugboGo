import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";

import {
  PRIVACY_POLICY_DRAFT,
  type PrivacyPolicyDraftBlock,
} from "../constants/privacyPolicyDraft";

/** Renders a supplied draft paragraph, subheading, or wrapping list. */
function DraftBlock({ block }: { block: PrivacyPolicyDraftBlock }) {
  if (block.type === "list") {
    return (
      <View className="gap-2">
        {/* Ordered or bulleted policy items */}
        {block.items.map((item, index) => (
          <View key={index} className="flex-row items-start gap-2">
            <AppText
              accessible={false}
              importantForAccessibility="no"
              className="min-w-6 shrink-0 text-base leading-6 text-text-primary"
            >
              {block.ordered ? `${index + 1}.` : "•"}
            </AppText>
            <AppText
              accessibilityLabel={
                block.ordered ? `${index + 1}. ${item}` : undefined
              }
              className="flex-1 text-base leading-6 text-text-primary"
            >
              {item}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  const isSubheading = block.type === "subheading";

  return (
    <AppText
      accessibilityRole={isSubheading ? "header" : undefined}
      weight={isSubheading ? "semibold" : "regular"}
      className={
        isSubheading
          ? "mt-2 text-base text-text-primary"
          : "text-base leading-6 text-text-primary"
      }
    >
      {block.text}
    </AppText>
  );
}

/** Shows the supplied draft only in development and retains the placeholder in production. */
export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Persistent development-review status, outside the scrolling document */}
      {__DEV__ && (
        <View className="border-b border-border-primary bg-info px-6 py-3">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Draft — Pending Team Approval
          </AppText>
        </View>
      )}

      {/* Policy document or production placeholder */}
      <ScrollView
        testID="privacy-policy-scroll"
        className="flex-1"
        contentContainerClassName="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        {__DEV__ ? (
          <View className="gap-6">
            {PRIVACY_POLICY_DRAFT.map((section) => (
              <View key={section.id} className="gap-3">
                <AppText
                  accessibilityRole="header"
                  weight="bold"
                  className="text-lg leading-7 text-text-primary"
                >
                  {section.heading}
                </AppText>
                <View className="gap-3">
                  {section.blocks.map((block, index) => (
                    <DraftBlock key={index} block={block} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <>
            <AppText weight="semibold" className="text-sm text-text-secondary">
              Development placeholder
            </AppText>
            <AppText className="mt-2 text-base leading-6 text-text-primary">
              Privacy Policy content is under review and is not yet available.
            </AppText>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
