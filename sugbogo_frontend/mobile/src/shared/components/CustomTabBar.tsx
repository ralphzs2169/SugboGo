// src/shared/components/CustomTabBar.tsx
import { theme } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps, useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type TabBarPropsArg = Parameters<TabBarProps>[0];

export type TabBarConfig = {
  [routeName: string]: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
  };
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
      speed: 16,
      bounciness: 8,
    }).start();
  }, [isFocused, progress]);

  const activeBackgroundOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const activeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const activeTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const iconName = config[routeName]?.icon ?? "circle";
  const label = config[routeName]?.label ?? routeName;

  const activeColor = isFocused
    ? theme.extends.colors.brand
    : theme.extends.colors.text.tertiary;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="flex-1 cursor-pointer items-center justify-center"
    >
      <Animated.View
        className="relative w-full items-center justify-center rounded-full px-1 py-1.5"
        style={{
          transform: [{ scale: activeScale }, { translateY: activeTranslateY }],
        }}
      >
        {/* Active muted background */}
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-full bg-background"
          style={{
            opacity: activeBackgroundOpacity,
          }}
        />

        {/* Icon */}
        <Feather name={iconName} size={20} color={activeColor} />

        {/* Label */}
        <Animated.Text
          className="mt-0.5 text-[10px] font-medium"
          style={{
            color: activeColor,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Animated.Text>
      </Animated.View>
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
      className="absolute bottom-0 left-0 right-0 items-center bg-transparent"
      style={{ paddingBottom: insets.bottom + 10 }}
    >
      <View
        className="w-[95%] flex-row items-center justify-between rounded-full bg-white px-sm"
        style={{
          height: 60,
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
