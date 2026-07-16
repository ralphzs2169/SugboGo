import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";

import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";

export default function VerifyEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const openEmailApp = async () => {
    const supported = await Linking.canOpenURL("mailto:");

    if (supported) {
      await Linking.openURL("mailto:");
    }
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

      <AuthButton
        title="Resend Email (Coming Soon)"
        onPress={() => {}}
        disabled
        icon={<MaterialIcons name="refresh" size={20} color="white" />}
        className="mb-6"
      />

      <BottomAuthLink
        text=""
        actionText="← Back to Login"
        onPress={() => router.replace("/(auth)/login")}
      />
    </AuthLayout>
  );
}
