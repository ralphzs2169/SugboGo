import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getProfile } from "../api/profile.service";
import { useAuthStore } from "@/features/auth/store/auth.store";

export function useProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          const profile = await getProfile();

          setUser(profile);
        } catch (error) {
          console.log("Profile request failed.", error);
        }
      };

      fetchProfile();
    }, [setUser]),
  );
}
