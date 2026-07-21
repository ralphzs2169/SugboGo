import { Redirect } from "expo-router";

export default function OAuthRedirect() {
  return <Redirect href="/(auth)/login" />;
}
