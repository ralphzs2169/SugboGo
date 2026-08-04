import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AuthLayoutProps {
  children: ReactNode;
  paddingTop?: number;
}

/**
 * AuthLayout component provides a layout for authentication screens with keyboard handling and scrollable content.
 *
 * @param {ReactNode} children - The content displayed inside the layout.
 * @param {number} paddingBottom - Optional bottom padding for the scrollable content.
 *  * @param {number} paddingTop - Optional top padding for the scrollable content.
 */
function AuthLayout({ children, paddingTop = 62 }: AuthLayoutProps) {
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
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
            paddingBottom: 32,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default AuthLayout;
