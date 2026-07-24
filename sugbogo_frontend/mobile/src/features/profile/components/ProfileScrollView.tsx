import { ReactNode, useRef } from "react";
import { Animated } from "react-native";
import ProfileStickyHeader from "./ProfileStickyHeader";

type Props = {
  firstname: string;
  lastname: string;
  children: ReactNode;
};

/**
 * ProfileScrollView handles the scrolling behavior and sticky profile header.
 */
export default function ProfileScrollView({
  firstname,
  lastname,
  children,
}: Props) {
  const stickyHeaderOpacity = useRef(new Animated.Value(0)).current;
  const stickyHeaderTranslateY = useRef(new Animated.Value(-20)).current;

  function handleScroll(event: any) {
    const offsetY = event.nativeEvent.contentOffset.y;

    Animated.parallel([
      Animated.timing(stickyHeaderOpacity, {
        toValue: offsetY > 120 ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }),

      Animated.timing(stickyHeaderTranslateY, {
        toValue: offsetY > 120 ? 0 : -20,
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
        contentContainerClassName="p-4 pb-8"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
    </>
  );
}
