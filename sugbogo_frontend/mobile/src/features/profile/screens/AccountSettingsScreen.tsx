import { ScrollView, Text } from "react-native";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import SettingRow from "../components/SettingRow";
import { useUpdateAvatarPreference } from "../hooks/useUpdateAvatarPreference";

export default function AccountSettingsScreen() {
  const user = useAuthStore((state) => state.user);

  const { updatePreference, isUpdating } = useUpdateAvatarPreference();
  const [showLoading, setShowLoading] = useState(false);
  const loadingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [useSocialAvatar, setUseSocialAvatar] = useState(
    user?.use_oauth_avatar ?? false,
  );

  async function handleSocialAvatarToggle(value: boolean) {
    if (isUpdating) {
      return;
    }

    const previousValue = useSocialAvatar;

    setUseSocialAvatar(value);

    loadingTimeout.current = setTimeout(() => {
      setShowLoading(true);
    }, 300);

    const response = await updatePreference({
      use_oauth_avatar: value,
    });

    if (loadingTimeout.current) {
      clearTimeout(loadingTimeout.current);
      loadingTimeout.current = null;
    }

    setShowLoading(false);

    if (!response.success) {
      setUseSocialAvatar(previousValue);

      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: response.message,
      });
    }
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="p-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 text-lg font-bold text-text">
          Profile Preferences
        </Text>

        <SettingRow
          title="Use connected social profile photo"
          description="Use your latest connected social account's profile photo when you don't have a custom picture."
          value={useSocialAvatar}
          onValueChange={handleSocialAvatarToggle}
          disabled={showLoading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
