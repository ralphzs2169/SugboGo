import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialIcons } from "@expo/vector-icons";

import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";
import { handleSystemError } from "@/shared/api/error.utils";
import EmailConfirmationLayout from "@/features/auth/components/EmailConfirmationLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useResendResetLink } from "@/features/auth/hooks/useResendResetLink";

export default function ResetLinkSentScreen() {
  const router = useRouter();

  const { email } = useLocalSearchParams<{
    email: string;
  }>();

  const { handleResendPasswordReset, loading } = useResendResetLink();

  const openEmailApp = async () => {
    try {
      const supported = await Linking.canOpenURL("mailto:");

      if (!supported) {
        Toast.show({
          type: "error",
          text1: "No email app found",
        });

        return;
      }

      await Linking.openURL("mailto:");
    } catch (error) {
      console.error("Failed to open email app:", error);

      Toast.show({
        type: "error",
        text1: "Unable to open email app",
      });
    }
  };

  const onResend = async () => {
    if (loading) return;

    if (!email) {
      Toast.show({
        type: "error",
        text1: "Email not found",
      });

      return;
    }

    try {
      const response = await handleResendPasswordReset(email);

      if (!response.success) {
        if (response.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter = response.errors?.retry_after as number | undefined;

          Toast.show({
            type: "error",
            text1: getRetryAfterMessage(retryAfter),
          });

          return;
        }

        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to resend reset link.",
        });

        return;
      }

      Toast.show({
        type: "success",
        text1: "Reset Link Sent",
      });
    } catch (error) {
      console.error("Unexpected resend reset link error:", error);

      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <EmailConfirmationLayout
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
    </EmailConfirmationLayout>
  );
}
