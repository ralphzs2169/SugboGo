import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { RefObject } from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import useBottomSheetBackHandler from "@/shared/hooks/useBottomSheetBackHandler";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  email: string;
  emailError: string;
  error: string;
  loading: boolean;
  onChangeEmail: (value: string) => void;
  onSubmit: () => Promise<void>;
  onDismiss: () => void;
};

/** Collects a resend address without changing the password screen's layout. */
export default function VerificationRecoverySheet({
  sheetRef,
  email,
  emailError,
  error,
  loading,
  onChangeEmail,
  onSubmit,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const backHandler = useBottomSheetBackHandler(sheetRef);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={backHandler.onChange}
      onDismiss={() => {
        backHandler.onDismiss();
        onDismiss();
      }}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.tertiary,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 32),
        }}
      >
        {/* Recovery context and address */}
        <AppText weight="bold" className="mb-2 text-xl text-text-primary">
          Resend verification email
        </AppText>
        <AppText className="mb-6 text-sm leading-5 text-text-secondary">
          Enter the email address you used to create your SugboGo account.
        </AppText>
        <FormInput
          InputComponent={BottomSheetTextInput}
          label="EMAIL ADDRESS"
          accessibilityLabel="Email address"
          placeholder="Enter your email"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          value={email}
          onChangeText={onChangeEmail}
          error={emailError}
        />
        {error ? (
          <AppText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mb-4 text-sm text-text-error"
          >
            {error}
          </AppText>
        ) : null}

        {/* Send and dismissal actions */}
        <Button
          title="Send verification email"
          onPress={onSubmit}
          loading={loading}
          rounded="full"
          textWeight="bold"
        />
        <Pressable
          onPress={() => sheetRef.current?.dismiss()}
          accessibilityRole="button"
          className="mt-2 min-h-12 cursor-pointer items-center justify-center active:opacity-60"
        >
          <AppText weight="semibold" className="text-sm text-text-secondary">
            Cancel
          </AppText>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
