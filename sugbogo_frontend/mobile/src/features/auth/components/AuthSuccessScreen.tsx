import LottieView from "lottie-react-native";
import { View } from "react-native";

import AuthLayout from "@/features/auth/components/AuthLayout";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type AuthSuccessScreenProps = {
  animation: React.ComponentProps<typeof LottieView>["source"];
  title: string;
  description: string;
  buttonTitle: string;
  onPress: () => void;
  buttonIcon?: React.ReactNode;
};

/**
 * Displays a reusable success state for authentication flows.
 *
 * Presents a success animation, supporting message, and primary follow-up
 * action for flows such as password reset and email verification.
 */
export default function AuthSuccessScreen({
  animation,
  title,
  description,
  buttonTitle,
  onPress,
  buttonIcon,
}: AuthSuccessScreenProps) {
  return (
    <AuthLayout>
      {/* Success animation */}
      <View className="items-center justify-center">
        <LottieView
          source={animation}
          autoPlay
          loop={false}
          style={{
            width: 250,
            height: 200,
          }}
        />
      </View>

      {/* Success message */}
      <View className="mb-7">
        <AppText
          weight="bold"
          className="text-center text-xl text-text-primary"
        >
          {title}
        </AppText>

        <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
          {description}
        </AppText>
      </View>

      {/* Primary follow-up action */}
      <Button
        title={buttonTitle}
        onPress={onPress}
        icon={buttonIcon}
        className="mt-2"
        textWeight="bold"
        rounded="full"
      />
    </AuthLayout>
  );
}
