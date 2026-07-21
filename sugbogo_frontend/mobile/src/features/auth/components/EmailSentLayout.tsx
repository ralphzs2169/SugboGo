import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import EmailSentIcon from "@/features/auth/assets/icons/email-sent.svg";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import SecondaryAuthButton from "./SecondaryAuthButton";

type EmailSentLayoutProps = {
  title: string;
  description: string;
  email?: string | null;

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
  openEmailApp,
  resendTitle = "Resend Email",
  onResend,
  resendLoading = false,
  children,
}: EmailSentLayoutProps) {
  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <EmailSentIcon width={200} height={200} />
      </View>

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        {title}
      </Text>

      <Text className="mb-2 text-center text-base text-text-secondary">
        {description}
      </Text>

      {email ? (
        <Text className="mb-8 text-center text-base font-bold text-text-primary">
          {email}
        </Text>
      ) : null}

      <AuthButton
        title="Open Email App"
        onPress={openEmailApp}
        icon={<MaterialIcons name="open-in-new" size={20} color="white" />}
        className="mb-4"
      />

      {onResend ? (
        <SecondaryAuthButton
          title={resendTitle}
          loading={resendLoading}
          onPress={onResend}
        />
      ) : null}

      {children}
    </AuthLayout>
  );
}
