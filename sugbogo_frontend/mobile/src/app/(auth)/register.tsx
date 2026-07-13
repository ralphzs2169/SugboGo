import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

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
 * Register component provides a user interface for creating a new account in the application.
 * It includes input fields for full name, email, password, and confirm password,
 * along with social login buttons and navigation to the login page.
 */
export default function Register() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Demo-only mock rules
  const MOCK_EMAIL = "sugbogo@gmail.com";
  const MOCK_PASSWORD = "sugbogo123";

  const handleRegister = () => {
    if (!fullName.trim()) {
      setErrorMsg("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setErrorMsg("Email address is required.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      setErrorMsg("");
      router.push("/(auth)/interest");
    } else {
      setErrorMsg(
        "Registration failed (demo). Please use the mock email/password.",
      );
    }
  };

  return (
    <AuthLayout>
      <AuthHeader />

      <AuthCard>
        <Text className="mb-6 text-center text-lg font-bold text-dark">
          Create your Account
        </Text>

        <FormInput
          label="FULL NAME"
          placeholder="Enter your full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

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
        />

        <PasswordInput
          label="CONFIRM PASSWORD"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {errorMsg ? (
          <Text className="mb-3 text-small font-semibold text-error">
            {errorMsg}
          </Text>
        ) : null}

        <AuthButton
          title="Create Account"
          onPress={handleRegister}
          icon={
            <MaterialIcons
              name="keyboard-arrow-right"
              size={20}
              color="white"
            />
          }
        />

        <Divider text="OR SIGN UP WITH" />

        <SocialLoginButtons
          onGooglePress={() => {
            console.log("Google Register");
          }}
          onFacebookPress={() => {
            console.log("Facebook Register");
          }}
          onApplePress={() => {
            console.log("Apple Register");
          }}
        />
      </AuthCard>

      <BottomAuthLink
        text="Already have an account?"
        actionText="Login"
        onPress={() => router.push("/(auth)/interest")}
      />
    </AuthLayout>
  );
}