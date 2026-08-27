import { Stack } from "expo-router";

export default function BusinessLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="reviews"
        options={{
          headerShown: true,
          title: "Reviews",
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
