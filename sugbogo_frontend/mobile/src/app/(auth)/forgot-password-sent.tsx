import * as Linking from "expo-linking";
import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialIcons } from "@expo/vector-icons";

import EmailSentLayout from "@/features/auth/components/EmailSentLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useResendPasswordReset } from "@/features/auth/hooks/useResendPasswordReset";

export default function ForgotPasswordSent() {
  const router = useRouter();

  const { email } = useLocalSearchParams<{
    email: string;
  }>();

  const { handleResendPasswordReset, loading } = useResendPasswordReset();

  useEffect(() => {
    Toast.show({
      type: "success",
      text1: "Reset Link Sent",
      text2: "Check your inbox for the password reset email.",
    });
  }, []);

  const openEmailApp = async () => {
    try {
      const supported = await Linking.canOpenURL("mailto:");

      if (!supported) {
        Toast.show({
          type: "error",
          text1: "No email app found",
          text2: "Please install an email application.",
        });

        return;
      }

      await Linking.openURL("mailto:");
    } catch (error) {
      console.error("Failed to open email app:", error);

      Toast.show({
        type: "error",
        text1: "Unable to open email app",
        text2: "Please try again.",
      });
    }
  };

  const onResend = async () => {
    if (loading) return;

    if (!email) {
      Toast.show({
        type: "error",
        text1: "Missing Email",
        text2: "Email address is unavailable.",
      });

      return;
    }

    const response = await handleResendPasswordReset(email);

    if (!response.success) {
      const retryAfter = response.errors?.retry_after as number | undefined;

      if (retryAfter) {
        const minutes = Math.ceil(retryAfter / 60);

        Toast.show({
          type: "error",
          text1: "Too Many Requests",
          text2: `Please try again in ${minutes} minute${
            minutes === 1 ? "" : "s"
          }.`,
        });

        return;
      }

      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: response.message,
      });

      return;
    }

    Toast.show({
      type: "success",
      text1: "Reset Link Sent",
      text2: "A new password reset email has been sent.",
    });
  };

  return (
    <EmailSentLayout
      title="Check your email"
      description="If an account exists with this email, we've sent a password reset link to:"
      email={email}
      openEmailApp={openEmailApp}
      resendTitle="Resend Reset Link"
      onResend={onResend}
      resendLoading={loading}
    >
      <BottomAuthLink
        text=""
        actionText="Back to Login"
        icon={
          <MaterialIcons
            name="arrow-back"
            size={20}
            color="#F27F0D"
            style={{ marginRight: 4 }}
          />
        }
        onPress={() => router.replace("/(auth)/login")}
      />
    </EmailSentLayout>
  );
}
