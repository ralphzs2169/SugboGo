// src/app/fb-test.tsx
import { View, Text, Button, Alert } from "react-native";
import {
  LoginManager,
  AccessToken,
  GraphRequest,
  GraphRequestManager,
} from "react-native-fbsdk-next";

export default function FbTest() {
  const handleLogin = async () => {
    console.log("1. Starting Facebook login");

    try {
      console.log("2. Calling logInWithPermissions...");

      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);

      console.log("3. LoginManager returned");
      console.log(result);

      if (result.isCancelled) {
        console.log("4. User cancelled");
        Alert.alert("Login cancelled");
        return;
      }

      console.log("5. Fetching access token...");

      const data = await AccessToken.getCurrentAccessToken();

      console.log("6. Access token result:", data);

      if (!data) {
        Alert.alert("No access token returned");
        return;
      }

      console.log("7. Token:", data.accessToken.toString());
    } catch (e) {
      console.log("8. Exception:", e);
      Alert.alert("Login error", JSON.stringify(e));
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ marginBottom: 20 }}>Facebook Login Test</Text>
      <Button title="Login with Facebook" onPress={handleLogin} />
    </View>
  );
}
