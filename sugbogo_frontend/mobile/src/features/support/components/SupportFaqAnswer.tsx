import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import {
  getSupportFaqText,
  type SupportFaqContent,
  type SupportFaqText,
} from "../constants/supportFaqDraft";

/** Renders explicit emphasis segments as native nested text while preserving readable sentences. */
function AnswerText({ parts, accessibilityLabel }: {
  parts: SupportFaqText;
  accessibilityLabel?: string;
}) {
  return (
    <AppText
      accessibilityLabel={accessibilityLabel}
      className="text-base leading-6 text-text-secondary"
    >
      {parts.map((part, index) => typeof part === "string" ? part : (
        <AppText key={index} weight="bold" className="text-text-secondary">{part.text}</AppText>
      ))}
    </AppText>
  );
}

/** Presents an approved FAQ answer with ordered steps, inline emphasis and supplementary notes. */
export default function SupportFaqAnswer({ faq }: { faq: SupportFaqContent }) {
  return (
    <View testID="support-faq-answer" className="gap-4 px-4 pb-4">
      {/* Introduction */}
      <View className="gap-3">
        {faq.paragraphs.map((parts, index) => <AnswerText key={index} parts={parts} />)}
      </View>

      {/* Numbered steps retain their complete spoken labels. */}
      {faq.steps.length > 0 && (
        <View testID="support-faq-steps" className="gap-3">
          {faq.steps.map((parts, index) => (
            <View key={index} className="flex-row items-start gap-3">
              <AppText
                accessible={false}
                importantForAccessibility="no"
                weight="bold"
                className="min-w-6 shrink-0 text-base leading-6 text-text-secondary"
              >
                {index + 1}.
              </AppText>
              <View className="min-w-0 flex-1">
                <AnswerText
                  parts={parts}
                  accessibilityLabel={`${index + 1}. ${getSupportFaqText(parts)}`}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Additional explanation */}
      {faq.explanation && (
        <View className="gap-3">
          <AppText accessibilityRole="header" weight="bold" className="text-base text-text-primary">
            {faq.explanation.heading}
          </AppText>
          <AnswerText parts={faq.explanation.text} />
        </View>
      )}

      {/* Supplementary information */}
      {faq.goodToKnow && (
        <View className="gap-3 rounded-xl border border-border-primary bg-background p-3">
          <AppText accessibilityRole="header" weight="semibold" className="text-base text-text-primary">
            Good to know
          </AppText>
          {faq.goodToKnow.map((parts, index) => <AnswerText key={index} parts={parts} />)}
        </View>
      )}
    </View>
  );
}
