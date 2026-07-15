import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

interface AuthLayoutProps {
  children: ReactNode;
  paddingBottom?: number;
  paddingTop?: number;
}

/**
 * AuthLayout component provides a layout for authentication screens with keyboard handling and scrollable content.
 *
 * @param {ReactNode} children - The content displayed inside the layout.
 * @param {number} paddingBottom - Optional bottom padding for the scrollable content.
 *  * @param {number} paddingTop - Optional top padding for the scrollable content.
 */
function AuthLayout({
  children,
  paddingBottom = 32,
  paddingTop = 62,
}: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1 bg-surface"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop,
          paddingBottom,
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AuthLayout;
