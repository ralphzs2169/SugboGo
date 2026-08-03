import { ReactNode, RefObject } from "react";
import { ScrollView, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RegistrationLayoutProps = {
  children: ReactNode;
  stepper: ReactNode;
  footer: ReactNode;
  scrollRef: RefObject<ScrollView | null>;
  overlay?: ReactNode;
};

/**
 * Shared layout for merchant registration.
 *
 * Keeps the stepper and footer fixed while
 * allowing the current step content to scroll.
 */
export default function RegistrationLayout({
  children,
  stepper,
  footer,
  scrollRef,
  overlay,
}: RegistrationLayoutProps) {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {stepper}

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>{children}</View>
        </ScrollView>

        {footer}

        {overlay}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
