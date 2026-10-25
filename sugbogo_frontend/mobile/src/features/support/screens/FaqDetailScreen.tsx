import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import type { SupportFaq } from "../constants/supportFaqDraft";

/** Renders approved FAQ paragraphs, ordered steps and notes, or a safe recovery state. */
export default function FaqDetailScreen({ faq }: { faq?: SupportFaq }) {
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        testID="faq-detail-scroll"
        className="flex-1"
        contentContainerClassName="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        {faq ? (
          <View className="gap-6">
            {/* Introduction; the route header owns the question title. */}
            <View className="gap-3">
              {faq.paragraphs.map((paragraph, index) => (
                <AppText
                  key={index}
                  className="text-base leading-6 text-text-primary"
                >
                  {paragraph}
                </AppText>
              ))}
            </View>

            {/* Numbered guidance wraps independently of its decorative number. */}
            {faq.steps.length > 0 && (
              <View testID="faq-steps" className="gap-4">
                {faq.steps.map((step, index) => (
                  <View key={index} className="flex-row items-start gap-3">
                    <AppText
                      accessible={false}
                      importantForAccessibility="no"
                      weight="bold"
                      className="min-w-6 shrink-0 text-base leading-6 text-brand"
                    >
                      {index + 1}.
                    </AppText>
                    <AppText
                      accessibilityLabel={`${index + 1}. ${step}`}
                      className="min-w-0 flex-1 text-base leading-6 text-text-primary"
                    >
                      {step}
                    </AppText>
                  </View>
                ))}
              </View>
            )}

            {/* Additional approved explanation. */}
            {faq.explanation && (
              <View className="gap-3">
                <AppText
                  accessibilityRole="header"
                  weight="bold"
                  className="text-lg text-text-primary"
                >
                  {faq.explanation.heading}
                </AppText>
                <AppText className="text-base leading-6 text-text-primary">
                  {faq.explanation.text}
                </AppText>
              </View>
            )}

            {/* Supplementary notes retain the existing rounded information treatment. */}
            {faq.goodToKnow && (
              <View className="gap-3 rounded-xl border border-border-primary bg-surface p-4">
                <AppText
                  accessibilityRole="header"
                  weight="semibold"
                  className="text-base text-text-primary"
                >
                  Good to know
                </AppText>
                {faq.goodToKnow.map((paragraph, index) => (
                  <AppText
                    key={index}
                    className="text-base leading-6 text-text-secondary"
                  >
                    {paragraph}
                  </AppText>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Unknown identifiers never render another FAQ or echo untrusted input. */
          <View className="gap-6">
            <AppText className="text-base leading-6 text-text-primary">
              This FAQ is unavailable. You can return to Contact Support to view
              the available questions.
            </AppText>
            <Button
              title="Back to Contact Support"
              onPress={() => router.replace("/contact-support")}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
