import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

export default function OAuthRedirect() {
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log("OAuth callback params:", params);
  }, []);

  return null;
}
