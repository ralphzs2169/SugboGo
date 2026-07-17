import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import EmailSentIcon from "@/features/auth/assets/icons/email-sent.svg";
import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useState } from "react";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import SecondaryAuthButton from "@/features/auth/components/SecondaryAuthButton";

export default function VerifyEmail() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingEmail = useVerificationStore((state) => state.pendingEmail);

  const { handleResend, loading } = useResendVerification();

  // Function to open the default email application on the user's device
  const openEmailApp = async () => {
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
  };

  // Function to handle the resend verification email action
  const onResend = async () => {
    if (!pendingEmail) {
      setError("Email address is missing.");
      return;
    }

    setMessage("");
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

      // Handle rate limiting error
      if (retryAfter) {
        const minutes = Math.ceil(retryAfter / 60);

        Toast.show({
          type: "error",
          text1: "Too Many Requests",
          text2: `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Request Failed",
          text2: response.message,
        });
      }

      return;
    }

    Toast.show({
      type: "success",
      text1: "Verification Email Sent",
      text2: "Please check your inbox.",
    });
  };

  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <EmailSentIcon width={200} height={200} />
      </View>

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Verify you email
      </Text>

      <Text className="mb-2 text-center text-base text-text-secondary">
        We've sent a verification email to
      </Text>

      <Text className="mb-6 text-center text-base font-bold text-text-primary">
        {pendingEmail}
      </Text>

      {message ? (
        <Text className="mb-4 text-center text-sm font-semibold text-green-600">
          {message}
        </Text>
      ) : null}

      {error ? (
        <Text className="mb-4 text-center text-sm font-semibold text-error">
          {error}
        </Text>
      ) : null}

      <AuthButton
        title="Open Email App"
        onPress={openEmailApp}
        icon={<MaterialIcons name="open-in-new" size={20} color="white" />}
        className="mb-4"
      />

      <SecondaryAuthButton
        title="Resend Email"
        loading={loading}
        onPress={onResend}
      />
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
    </AuthLayout>
  );
}
