import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthCard from "@/components/auth/AuthCard";
import FormInput from "@/components/auth/FormInput";
import PasswordInput from "@/components/auth/PasswordInput";
import AuthButton from "@/components/auth/AuthButton";
import Divider from "@/components/auth/Divider";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import BottomAuthLink from "@/components/auth/BottomAuthLink";

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
        <Text className="mb-6 text-center text-[20px] font-bold text-[#1A1A1A]">
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
              <Text className="text-[11px] font-bold tracking-[0.5px] text-[#F27F0D]">
                FORGOT?
              </Text>
            </TouchableOpacity>
          }
        />

        {errorMsg ? (
          <Text className="mb-3 text-[12px] font-semibold text-[#DC2626]">
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
