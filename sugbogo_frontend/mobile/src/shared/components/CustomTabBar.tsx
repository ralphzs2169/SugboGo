// src/shared/components/CustomTabBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps, useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type TabBarPropsArg = Parameters<TabBarProps>[0];

export type TabBarConfig = {
  [routeName: string]: { icon: keyof typeof Ionicons.glyphMap; label: string };
};

function TabItem({
  routeName,
  isFocused,
  onPress,
  config,
}: {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  config: TabBarConfig;
}) {
  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
  }, [isFocused]);

  const circleScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const circleOpacity = progress;
  const iconColor = isFocused ? "#F27F0D" : "#666666";
  const labelOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const iconName = config[routeName]?.icon ?? "ellipse-outline";
  const label = config[routeName]?.label ?? routeName;

  return (
    <Pressable onPress={onPress} className="flex-1 items-center justify-center">
      <View className="w-9 h-9 items-center justify-center">
        <Animated.View
          className="absolute w-9 h-9 rounded-full bg-brand"
          style={{
            opacity: circleOpacity,
            transform: [{ scale: circleScale }],
          }}
        />
        <Ionicons
          name={iconName}
          size={20}
          color={isFocused ? "#fff" : iconColor}
        />
      </View>
      <Animated.Text
        className="text-xs"
        style={{
          color: isFocused ? "#F27F0D" : "#666666",
          opacity: labelOpacity,
        }}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export default function CustomTabBar({
  state,
  navigation,
  config,
}: TabBarPropsArg & { config: TabBarConfig }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-0 right-0 bottom-0 items-center bg-transparent"
      style={{ paddingBottom: insets.bottom + 10 }}
    >
      <View
        className="flex-row items-center justify-between bg-white rounded-tag px-md w-[95%]"
        style={{
          height: 66,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
              config={config}
            />
          );
        })}
      </View>
    </View>
  );
}
