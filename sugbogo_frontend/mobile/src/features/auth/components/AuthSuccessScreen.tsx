import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { Text, View } from "react-native";

import AuthLayout from "@/features/auth/components/AuthLayout";
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
 * Reusable success screen for authentication flows.
 *
 * Displays a success animation, title, description, and a
 * primary action button. Used for screens such as password
 * reset success and email verification.
 */
export default function AuthSuccessScreen({
  animation,
  title,
  description,
  buttonTitle,
  onPress,
  buttonIcon = <MaterialCommunityIcons name="login" size={20} color="white" />,
}: AuthSuccessScreenProps) {
  return (
    <AuthLayout>
      <View className="items-center justify-center">
        <LottieView
          source={animation}
          autoPlay
          loop={false}
          style={{
            width: 300,
            height: 220,
          }}
        />
      </View>

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        {title}
      </Text>

      <Text className="mb-10 text-center text-base text-text-secondary">
        {description}
      </Text>

      <Button
        title={buttonTitle}
        onPress={onPress}
        icon={buttonIcon}
        className="mt-2 mb-20 shadow"
        fontClassName="text-md font-bold"
      />
    </AuthLayout>
  );
}
