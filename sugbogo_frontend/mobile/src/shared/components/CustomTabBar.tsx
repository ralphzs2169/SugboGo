// src/shared/components/CustomTabBar.tsx
import { theme } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps, useEffect, useRef } from "react";
import { Animated, Pressable, useWindowDimensions, View } from "react-native";
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

  const activeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  const activeTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const iconName = config[routeName]?.icon ?? "circle";
  const label = config[routeName]?.label ?? routeName;

  const activeColor = isFocused
    ? theme.extends.colors.brand
    : theme.extends.colors.text.secondary;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      className="flex-1 cursor-pointer items-center justify-center"
    >
      {/* Tab content */}
      <Animated.View
        className="items-center justify-center"
        style={{
          transform: [{ scale: activeScale }, { translateY: activeTranslateY }],
        }}
      >
        {/* Icon */}
        <Feather name={iconName} size={21} color={activeColor} />

        {/* Label */}
        <Animated.Text
          className="mt-1 text-[10px] font-medium"
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

/**
 * Renders the application's standard bottom navigation bar.
 *
 * The bar spans the full screen width, respects the device safe area, and
 * displays a sliding top indicator aligned with the currently active tab.
 */
export default function CustomTabBar({
  state,
  navigation,
  config,
}: TabBarPropsArg & { config: TabBarConfig }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const indicatorPosition = useRef(new Animated.Value(state.index)).current;

  const tabWidth = width / state.routes.length;

  useEffect(() => {
    Animated.spring(indicatorPosition, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [state.index, indicatorPosition]);

  const indicatorTranslateX = Animated.multiply(indicatorPosition, tabWidth);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border-primary bg-white"
      style={{
        paddingBottom: insets.bottom,
      }}
    >
      {/* Active tab indicator */}
      <Animated.View
        pointerEvents="none"
        className="absolute left-0 top-0 h-[3px] bg-brand"
        style={{
          width: tabWidth,
          transform: [{ translateX: indicatorTranslateX }],
        }}
      />

      {/* Navigation items */}
      <View
        className="flex-row items-center"
        style={{
          height: 64,
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
