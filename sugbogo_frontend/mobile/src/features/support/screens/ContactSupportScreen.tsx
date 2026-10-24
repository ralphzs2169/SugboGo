import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import InputContainer from "@/shared/components/form/InputContainer";

import { SUPPORT_FAQS } from "../constants/supportFaqDraft";

const GREETING_MASCOT = require("@/shared/assets/mascot/mascot-greeting.webp");

/** Offers temporary concern editing and navigation to approved FAQs; submission is unavailable. */
export default function ContactSupportScreen() {
  const router = useRouter();
  const [concern, setConcern] = useState("");

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          testID="support-scroll"
          className="flex-1"
          contentContainerClassName="px-6 pb-6 pt-3"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting; the route retains the navigation title. */}
          <View className="mb-6 items-center">
            <Image
              testID="support-mascot"
              source={GREETING_MASCOT}
              style={{ width: 144, height: 144 }}
              contentFit="contain"
              accessible={false}
            />
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="mt-2 text-center text-xl text-brand"
            >
              Hi there, Explorer!
            </AppText>
            <AppText className="mt-1 text-center text-base text-text-secondary">
              How can we help you today?
            </AppText>
          </View>

          {/* UI-only concern: no persistence, logging, network, or email handoff. */}
          <InputContainer label="Tell us your concern">
            <TextInput
              accessibilityLabel="Tell us your concern"
              accessibilityHint="Temporary text only. Submission is not available yet."
              placeholder="Tell us about your concern or question..."
              placeholderTextColor={theme.extends.colors.text.secondary}
              value={concern}
              onChangeText={setConcern}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[120px] flex-1 py-[14px] font-nunito text-base leading-6 text-text-primary"
            />
          </InputContainer>
          <Button
            title="Submit"
            disabled
            // The shared button requires a callback; this disabled preview has no action.
            onPress={() => undefined}
            rounded="full"
          />
          <AppText className="mt-2 text-center text-sm text-text-secondary">
            Submission coming soon
          </AppText>
          <AppText className="mt-1 text-center text-sm text-text-secondary">
            Your text is not submitted or saved.
          </AppText>

          {/* Approved questions open their dedicated detail pages. */}
          <View className="mt-6">
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="text-lg text-text-primary"
            >
              Frequently Asked Questions
            </AppText>
            <View className="mt-3 overflow-hidden rounded-xl border border-border-primary bg-surface">
              {SUPPORT_FAQS.map((faq, index) => (
                <View
                  key={faq.id}
                  className={index > 0 ? "border-t border-border-primary" : ""}
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={faq.question}
                    onPress={() =>
                      router.push({
                        pathname: "/contact-support/faq/[faqId]",
                        params: { faqId: faq.id },
                      })
                    }
                    className="min-h-14 cursor-pointer flex-row items-center gap-3 px-4 py-4 active:opacity-70"
                  >
                    <AppText
                      weight="semibold"
                      className="min-w-0 flex-1 text-base text-text-primary"
                    >
                      {faq.question}
                    </AppText>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={24}
                      color={theme.extends.colors.text.secondary}
                      accessible={false}
                      importantForAccessibility="no"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
