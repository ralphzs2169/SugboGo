import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import AuthButton from "@/features/auth/components/AuthButton";
import AuthCard from "@/features/auth/components/AuthCard";
import AuthHeader from "@/features/auth/components/AuthHeader";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import Divider from "@/features/auth/components/Divider";
import FormInput from "@/features/auth/components/FormInput";
import PasswordInput from "@/features/auth/components/PasswordInput";
import SocialLoginButtons from "@/features/auth/components/SocialLoginButtons";

/**
 * Login component provides a user interface for logging into the application.
 * It includes input fields for email and password, social login buttons, and navigation to the registration page.
 */
export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const MOCK_EMAIL = "sugbogo@gmail.com";
  const MOCK_PASSWORD = "sugbogo123";

  const handleLogin = () => {
    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      setErrorMsg("");
      router.replace("/(explorer)/(tabs)/explore");
    } else {
      setErrorMsg("Invalid email or password. Please try again.");
    }
  };

  return (
    <AuthLayout>
      <AuthHeader />

      <AuthCard>
        <Text className="mb-6 text-center text-lg font-bold text-dark">
          Login to your account
        </Text>

        <FormInput
          label="EMAIL ADDRESS"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <PasswordInput
          label="PASSWORD"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          rightElement={
            <TouchableOpacity>
              <Text className="text-xs font-bold tracking-[0.5px] text-brand">
                FORGOT?
              </Text>
            </TouchableOpacity>
          }
        />

        {errorMsg ? (
          <Text className="mb-3 text-small font-semibold text-error">
            {errorMsg}
          </Text>
        ) : null}

        <AuthButton
          title="Login"
          onPress={handleLogin}
          icon={<MaterialCommunityIcons name="login" size={20} color="white" />}
        />

        <Divider text="OR LOG IN WITH" />

        <SocialLoginButtons
          onGooglePress={() => {
            console.log("Google Login");
          }}
          onFacebookPress={() => {
            console.log("Facebook Login");
          }}
          onApplePress={() => {
            console.log("Apple Login");
          }}
        />
      </AuthCard>

      <BottomAuthLink
        text="New to SugboGo?"
        actionText="Create an account"
        onPress={() => router.push("/(auth)/register")}
      />
    </AuthLayout>
  );
}