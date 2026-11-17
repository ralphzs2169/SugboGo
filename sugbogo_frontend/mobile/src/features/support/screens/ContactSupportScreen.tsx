import { Image } from "expo-image";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import InputContainer from "@/shared/components/form/InputContainer";

import SupportFaqList from "../components/SupportFaqList";

const GREETING_MASCOT = require("@/shared/assets/mascot/mascot-greeting.webp");

/** Offers local concern editing, unavailable-submission feedback and single-open approved FAQs. */
export default function ContactSupportScreen() {
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
          <InputContainer label="Tell us your concern" showLabel={false}>
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
            onPress={() =>
              Toast.show({
                type: "info",
                text1: "Support submissions aren't available yet. Your message hasn't been sent.",
              })
            }
            rounded="full"
          />

          {/* Frequently asked questions */}
          <View className="mt-6 gap-3">
            <AppText
              accessibilityRole="header"
              weight="bold"
              className="text-lg text-text-primary"
            >
              Frequently Asked Questions
            </AppText>
            <SupportFaqList />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
