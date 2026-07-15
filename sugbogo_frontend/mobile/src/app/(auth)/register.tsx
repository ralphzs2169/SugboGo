import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useRegister } from "@/features/auth/hooks/useRegister";
import {
  RegisterErrors,
  validateRegisterForm,
} from "@/features/auth/utils/validators";
import { mapRegisterErrors } from "@/features/auth/utils/errorMapper";
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const { handleRegister, loading } = useRegister();

  const clearFieldError = (field: keyof RegisterErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  const onRegister = async () => {
    const validationErrors = validateRegisterForm(
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    );

    // Display client-side validation errors and stop invalid submissions.
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Clear previous errors before sending a new registration request.
    setErrors({});

    const response = await handleRegister(firstName, lastName, email, password);

    if (!response.success) {
      setErrors(mapRegisterErrors(response.errors ?? {}));
      return;
    }

    router.replace("/(setup)/interests");
  };

  return (
    <AuthLayout>
      <AuthHeader />

      <AuthCard>
        <Text className="mb-6 text-center text-lg font-bold text-text">
          Create your Account
        </Text>

        <FormInput
          label="FIRST NAME"
          placeholder="Enter your first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          onFocus={() => clearFieldError("firstName")}
          error={errors.firstName}
        />

        <FormInput
          label="LAST NAME"
          placeholder="Enter your last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          onFocus={() => clearFieldError("lastName")}
          error={errors.lastName}
        />
        <FormInput
          label="EMAIL ADDRESS"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          onFocus={() => clearFieldError("email")}
          error={errors.email}
        />

        <PasswordInput
          label="PASSWORD"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          onFocus={() => clearFieldError("password")}
        />

        <PasswordInput
          label="CONFIRM PASSWORD"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          onFocus={() => clearFieldError("confirmPassword")}
        />

        <AuthButton
          title="Create Account"
          onPress={onRegister}
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
        onPress={() => router.push("/(auth)/login")}
      />
    </AuthLayout>
  );
}
