import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getProfile } from "../api/profile.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Toast } from "react-native-toast-message/lib/src/Toast";

export function useProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          const profile = await getProfile();

          setUser(profile);
        } catch (error) {
          Toast.show({
            type: "error",
            text1: "Profile Fetch Failed",
            text2: "Unable to fetch profile data. Please try again.",
          });
        }
      };

      fetchProfile();
    }, [setUser]),
  );
}
