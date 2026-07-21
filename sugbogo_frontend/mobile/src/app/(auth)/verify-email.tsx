import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Toast from "react-native-toast-message";

import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import EmailSentLayout from "@/features/auth/components/EmailSentLayout";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useVerifyEmail } from "@/features/auth/hooks/useVerifyEmail";
import { useVerificationStore } from "@/features/auth/store/verification.store";

export default function VerifyEmail() {
  const router = useRouter();

  const [error, setError] = useState("");

  const pendingEmail = useVerificationStore((state) => state.pendingEmail);

  const { handleResend, loading } = useResendVerification();
  const { handleVerifyEmail } = useVerifyEmail();

  const { uid, token } = useLocalSearchParams();

  useEffect(() => {
    if (!uid || !token) return;

    const verify = async () => {
      try {
        const response = await handleVerifyEmail(
          uid.toString(),
          token.toString(),
        );

        if (response.success) {
          Toast.show({
            type: "success",
            text1: "Email Verified",
            text2: "Your account has been verified.",
          });

          router.replace("/(auth)/login");
          return;
        }

        Toast.show({
          type: "error",
          text1: "Verification Failed",
          text2: response.message,
        });
      } catch (error) {
        console.error("Unexpected email verification error:", error);

        Toast.show({
          type: "error",
          text1: "Verification Failed",
          text2: "Something unexpected happened. Please try again.",
        });
      }
    };

    verify();
  }, [uid, token]);

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

    if (!pendingEmail) {
      setError("Email address is missing.");
      return;
    }

    setError("");

    const response = await handleResend(pendingEmail);

    if (!response.success) {
      if (response.code === "EMAIL_ALREADY_VERIFIED") {
        Toast.show({
          type: "success",
          text1: "Email Already Verified",
          text2: "Your email is already verified.",
        });

        return;
      }

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
      text1: "Verification Email Sent",
      text2: "Please check your inbox.",
    });
  };

  return (
    <EmailSentLayout
      title="Verify your email"
      description="We've sent a verification email to"
      email={pendingEmail}
      openEmailApp={openEmailApp}
      resendTitle="Resend Email"
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
