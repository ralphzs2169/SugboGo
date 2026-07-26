import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import EmailSentIcon from "@/features/auth/assets/icons/email-sent.svg";
import Button from "@/shared/components/Button";
import AuthLayout from "./AuthLayout";
import SecondaryAuthButton from "./SecondaryAuthButton";
import LottieView from "lottie-react-native";
import emailSentAnimation from "../assets/animations/email-sent.json";

type EmailConfirmationLayoutProps = {
  title: string;
  description: string;
  email?: string | null;

  verifying?: boolean;
  openEmailApp: () => void;

  resendTitle?: string;
  onResend?: () => void;
  resendLoading?: boolean;

  children?: React.ReactNode;
};

export default function EmailSentLayout({
  title,
  description,
  email,
  verifying = false,
  openEmailApp,
  resendTitle = "Resend Email",
  onResend,
  resendLoading = false,
  children,
}: EmailConfirmationLayoutProps) {
  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <LottieView
          source={emailSentAnimation}
          autoPlay
          loop={false}
          style={{
            width: 180,
            height: 180,
          }}
        />
        {/* <EmailSentIcon width={200} height={200} /> */}
      </View>

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        {title}
      </Text>

      {verifying ? (
        <Text className="mb-8 text-center text-base text-text-secondary">
          Verifying your email...
        </Text>
      ) : (
        <>
          <Text className="mb-2 text-center text-base text-text-secondary">
            {description}
          </Text>

          {email ? (
            <Text className="mb-8 text-center text-base font-bold text-text-primary">
              {email}
            </Text>
          ) : null}
        </>
      )}

      <Button
        title="Open Email App"
        disabled={verifying}
        onPress={openEmailApp}
        icon={<MaterialIcons name="open-in-new" size={20} color="white" />}
        className="mb-4 mt-2 shadow"
        fontClassName="text-md font-bold"
      />

      {onResend ? (
        <SecondaryAuthButton
          title={resendTitle}
          disabled={verifying}
          loading={resendLoading}
          onPress={onResend}
        />
      ) : null}

      {children}
    </AuthLayout>
  );
}
