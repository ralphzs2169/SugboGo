import * as Linking from "expo-linking";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import EmailConfirmationLayout from "@/features/auth/components/EmailConfirmationLayout";
import Toast from "react-native-toast-message";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useVerifyEmail } from "@/features/auth/hooks/useVerifyEmail";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";
import { handleSystemError } from "@/shared/utils/apiErrors";

/**
 * Screen responsible for handling email verification.
 *
 * Automatically verifies users from the verification link parameters,
 * handles verification failures, and allows users to resend the
 * verification email.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const pendingEmail = useVerificationStore((state) => state.pendingEmail);

  const { handleResendVerification, loading: resending } =
    useResendVerification();
  const { handleVerifyEmail } = useVerifyEmail();

  const { uid, token } = useLocalSearchParams();

  useEffect(() => {
    if (!uid || !token) return;

    const verify = async () => {
      setVerifying(true);

      try {
        const response = await handleVerifyEmail(
          uid.toString(),
          token.toString(),
        );

        if (response.success) {
          router.replace("/(auth)/email-verified");
          return;
        }

        if (handleSystemError(response)) {
          return;
        }

        setVerifying(false);

        Toast.show({
          type: "error",
          text1: "Email verification failed.",
        });
      } catch (error) {
        setVerifying(false);

        console.error("Unexpected email verification error:", error);

        Toast.show({
          type: "error",
          text1: "Something went wrong. Please try again.",
        });
      }
    };

    verify();
  }, [uid, token, handleVerifyEmail, router]);

  const openEmailApp = async () => {
    try {
      const supported = await Linking.canOpenURL("mailto:");

      if (!supported) {
        Toast.show({
          type: "error",
          text1: "No email application found.",
        });

        return;
      }

      await Linking.openURL("mailto:");
    } catch (error) {
      console.error("Failed to open email app:", error);

      Toast.show({
        type: "error",
        text1: "Unable to open email application.",
      });
    }
  };

  const onResend = async () => {
    if (resending) return;

    if (!pendingEmail) {
      Toast.show({
        type: "error",
        text1: "Email address is missing.",
      });

      return;
    }

    setError("");

    const response = await handleResendVerification(pendingEmail);

    if (!response.success) {
      if (response.code === "EMAIL_ALREADY_VERIFIED") {
        Toast.show({
          type: "success",
          text1: "Your email is already verified.",
        });

        return;
      }

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
        text1: "Unable to resend verification email.",
      });

      return;
    }

    Toast.show({
      type: "success",
      text1: "Verification email sent.",
    });
  };

  if (verifying) {
    return (
      <LoadingScreen
        title="Verifying Email"
        description="Please wait while we verify your email address."
      />
    );
  }

  return (
    <EmailConfirmationLayout
      title="Verify your email"
      description="We've sent a verification email to"
      email={pendingEmail}
      verifying={verifying}
      openEmailApp={openEmailApp}
      resendTitle="Resend Email"
      onResend={onResend}
      resendLoading={resending}
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
