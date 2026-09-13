import { View } from "react-native";
import LottieView from "lottie-react-native";

import emailSentAnimation from "../assets/animations/email-sent.json";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import AuthLayout from "./AuthLayout";

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

/**
 * Displays a shared email confirmation state for verification and reset flows.
 *
 * Supports verification progress, email-app navigation, resend actions, and
 * optional flow-specific content while preserving consistent auth styling.
 */
export default function EmailSentLayout({
  title,
  description,
  email,
  verifying = false,
  openEmailApp,
  resendTitle = "Resend email",
  onResend,
  resendLoading = false,
  children,
}: EmailConfirmationLayoutProps) {
  return (
    <AuthLayout>
      {/* Email confirmation animation */}
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
      </View>

      {/* Email confirmation introduction */}
      <View className="mb-7">
        <AppText
          weight="bold"
          className="text-center text-xl text-text-primary"
        >
          {title}
        </AppText>

        {verifying ? (
          <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
            Verifying your email...
          </AppText>
        ) : (
          <>
            <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
              {description}
            </AppText>

            {email ? (
              <AppText
                weight="semibold"
                className="mt-2 text-center text-sm text-text-primary"
              >
                {email}
              </AppText>
            ) : null}
          </>
        )}
      </View>

      {/* Primary email action */}
      <Button
        title="Open email app"
        disabled={verifying}
        onPress={openEmailApp}
        className="mb-3 mt-2"
        textWeight="bold"
        rounded="full"
      />

      {/* Resend action */}
      {onResend ? (
        <Button
          title={resendTitle}
          onPress={onResend}
          loading={resendLoading}
          disabled={verifying}
          variant="outline"
          rounded="full"
          textWeight="semibold"
          className="mb-4"
        />
      ) : null}

      {/* Flow-specific content */}
      {children}
    </AuthLayout>
  );
}
