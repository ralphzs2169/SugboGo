import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import ForgotPasswordIcon from "@/features/auth/assets/icons/forgot-password.svg";
import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import FormInput from "@/features/auth/components/FormInput";
import { validateForgotPasswordForm } from "@/features/auth/utils/forgotPasswordValidator";
import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";

/**
 * ForgotPassword component provides a user interface for users to request a password reset.
 * It includes an input field for the user's email address and a button to send the reset link.
 */
export default function ForgotPassword() {
  const router = useRouter();

  const { handleForgotPassword, loading } = useForgotPassword();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});

  const [navigating, setNavigating] = useState(false);

  const clearEmailError = () => {
    setErrors({});
  };

  const handleSendResetLink = async () => {
    if (loading || navigating) return;

    const validationErrors = validateForgotPasswordForm(email);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const response = await handleForgotPassword(email);

    if (!response.success) {
      Toast.show({
        type: "error",
        text1: "Couldn't send reset email",
        text2: response.message,
      });
      return;
    }

    setNavigating(true);

    router.push({
      pathname: "/(auth)/forgot-password-sent",
      params: {
        email,
      },
    });
  };

  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <ForgotPasswordIcon width={200} height={200} />
      </View>
      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Forgot Password
      </Text>

      <Text className="mb-8 text-center text-base text-text-secondary">
        Enter your email address and we'll send you a link to reset your
        password.
      </Text>

      <FormInput
        label="EMAIL ADDRESS"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        onFocus={() => clearEmailError()}
      />

      <AuthButton
        title="Send Reset Link"
        loading={loading || navigating}
        onPress={handleSendResetLink}
        icon={
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color="white"
          />
        }
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
