import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * AuthLayout component provides a layout for authentication screens with keyboard handling and scrollable content.
 * @param {ReactNode} children - The content to be displayed inside the layout.
 */
function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24, // screen-x
          paddingTop: 60,        // screen-top
          paddingBottom: 32,     // xl
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AuthLayout;