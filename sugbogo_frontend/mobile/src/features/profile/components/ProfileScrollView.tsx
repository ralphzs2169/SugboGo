import { ReactNode, useRef, useState } from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import ProfileStickyHeader from "./ProfileStickyHeader";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

type Props = {
  firstname: string;
  lastname: string;
  children: ReactNode;
};

export default function ProfileScrollView({
  firstname,
  lastname,
  children,
}: Props) {
  const bottomSpacing = useTabBarSpacing();
  const [stickyHeaderOpacity] = useState(() => new Animated.Value(0));
  const [stickyHeaderTranslateY] = useState(() => new Animated.Value(-20));
  const isStickyHeaderVisible = useRef(false);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShowHeader = offsetY > 120;
    if (shouldShowHeader === isStickyHeaderVisible.current) {
      return;
    }
    isStickyHeaderVisible.current = shouldShowHeader;

    Animated.parallel([
      Animated.timing(stickyHeaderOpacity, {
        toValue: shouldShowHeader ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(stickyHeaderTranslateY, {
        toValue: shouldShowHeader ? 0 : -20,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <>
      <ProfileStickyHeader
        firstname={firstname}
        lastname={lastname}
        opacity={stickyHeaderOpacity}
        translateY={stickyHeaderTranslateY}
      />

      <Animated.ScrollView
        testID="profile-scroll-view"
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
    </>
  );
}
