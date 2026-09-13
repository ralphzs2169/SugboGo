import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AuthLayoutProps {
  children: ReactNode;
  paddingTop?: number;
}

/**
 * Provides a scrollable, keyboard-safe layout shared by authentication screens.
 *
 * Keeps focused form content accessible when the keyboard is open while
 * preserving consistent safe-area and page spacing across auth flows.
 */
export default function AuthLayout({
  children,
  paddingTop = 62,
}: AuthLayoutProps) {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      {/* Keyboard-safe authentication content */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1 bg-surface"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop,
            paddingBottom: 32,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
