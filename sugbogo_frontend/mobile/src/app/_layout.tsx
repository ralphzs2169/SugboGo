import "../../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="(explorer)"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}