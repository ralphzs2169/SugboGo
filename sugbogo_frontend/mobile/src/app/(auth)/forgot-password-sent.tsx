import * as Linking from "expo-linking";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import EmailSentIcon from "@/features/auth/assets/icons/email-sent.svg";
import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";

export default function ForgotPasswordSent() {
  const router = useRouter();

  Toast.show({
    type: "success",
    text1: "Reset Link Sent",
    text2: "Check your inbox for the password reset email.",
  });

  const { email } = useLocalSearchParams<{
    email: string;
  }>();

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

  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <EmailSentIcon width={200} height={200} />
      </View>
      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Check your email
      </Text>

      <Text className="mb-2 text-center text-base text-text-secondary">
        If an account exists with this email, we've sent a password reset link
        to:
      </Text>

      <Text className="mb-8 text-center text-base font-bold text-text-primary">
        {email}
      </Text>

      <AuthButton
        title="Open Email App"
        onPress={openEmailApp}
        icon={<MaterialIcons name="open-in-new" size={20} color="white" />}
        className="mb-4"
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
