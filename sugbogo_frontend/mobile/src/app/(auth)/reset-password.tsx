import ResetPasswordScreen from "@/features/auth/screens/ResetPasswordScreen";
import { useLocalSearchParams } from "expo-router";

export default function ResetPasswordRoute() {
  const { uid, token } = useLocalSearchParams();

  if (typeof uid !== "string" || !uid || typeof token !== "string" || !token) {
    return <ResetPasswordScreen key="invalid-link" />;
  }

  return (
    <ResetPasswordScreen
      key={JSON.stringify([uid, token])}
      proof={{ uid, token }}
    />
  );
}
