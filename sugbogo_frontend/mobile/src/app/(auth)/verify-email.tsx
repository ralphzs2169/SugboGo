import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";

import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useState } from "react";

export default function VerifyEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { handleResend, loading } = useResendVerification();

  const openEmailApp = async () => {
    const supported = await Linking.canOpenURL("mailto:");

    if (supported) {
      await Linking.openURL("mailto:");
    }
  };

  const onResend = async () => {
    if (!email) {
      setError("Email address is missing.");
      return;
    }

    setMessage("");
    setError("");

    const response = await handleResend(email);

    if (!response.success) {
      setError(response.error?.detail ?? "Unable to resend email.");

      return;
    }

    setMessage("Verification email sent successfully.");
  };

  return (
    <AuthLayout>
      <MaterialIcons
        name="mark-email-read"
        size={72}
        color="#16A34A"
        style={{ alignSelf: "center", marginBottom: 24 }}
      />

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Account Created!
      </Text>

      <Text className="mb-2 text-center text-base text-text-secondary">
        We've sent a verification email to
      </Text>

      <Text className="mb-6 text-center text-base font-bold text-text-primary">
        {email}
      </Text>

      <Text className="mb-10 text-center text-base leading-6 text-text-secondary">
        Please check your inbox and click the verification link before signing
        in.
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

      <AuthButton
        title="I've Verified My Email"
        onPress={() => router.replace("/(auth)/login")}
        icon={<MaterialIcons name="check-circle" size={20} color="white" />}
        className="mb-4"
      />

      <AuthButton title="Resend Email" loading={loading} onPress={onResend} />

      <BottomAuthLink
        text=""
        actionText="← Back to Login"
        onPress={() => router.replace("/(auth)/login")}
      />
    </AuthLayout>
  );
}
