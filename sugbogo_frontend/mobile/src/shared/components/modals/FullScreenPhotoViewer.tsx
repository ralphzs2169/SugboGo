import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PHOTO_CATEGORY_LABELS } from "@/shared/constants/businessPhotoCategories";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export type PhotoViewerItem = {
  uri: string;
  category?: string;
};

type Props = {
  photos: PhotoViewerItem[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
  headerContent?: ReactNode;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MAX_SCALE = 3;

type ZoomablePhotoProps = {
  photo: PhotoViewerItem;
  onZoomStateChange: (isZoomed: boolean) => void;
};

/**
 * Renders an individual gallery image with pinch-to-zoom, panning,
 * and double-tap zoom interactions.
 */
function ZoomablePhoto({ photo, onZoomStateChange }: ZoomablePhotoProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const nextScale = Math.min(
        Math.max(savedScale.value * event.scale, 1),
        MAX_SCALE,
      );

      scale.value = nextScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      if (scale.value <= 1.02) {
        scale.value = withSpring(1);
        savedScale.value = 1;

        translateX.value = withSpring(0);
        translateY.value = withSpring(0);

        savedTranslateX.value = 0;
        savedTranslateY.value = 0;

        scheduleOnRN(onZoomStateChange, false);
        return;
      }

      scheduleOnRN(onZoomStateChange, true);
    });

  const panGesture = Gesture.Pan()
    .enabled(scale.value > 1)
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;

        translateX.value = withSpring(0);
        translateY.value = withSpring(0);

        savedTranslateX.value = 0;
        savedTranslateY.value = 0;

        scheduleOnRN(onZoomStateChange, false);
        return;
      }

      scale.value = withSpring(2);
      savedScale.value = 2;

      scheduleOnRN(onZoomStateChange, true);
    });

  const gesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    return () => {
      scale.value = 1;
      savedScale.value = 1;

      translateX.value = 0;
      translateY.value = 0;

      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    };
  }, []);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
        }}
        className="items-center justify-center overflow-hidden"
      >
        <Animated.View
          style={[
            {
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
            },
            animatedStyle,
          ]}
        >
          <Image
            source={{ uri: photo.uri }}
            contentFit="contain"
            transition={150}
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
type AnimatedPaginationDotProps = {
  isActive: boolean;
};

/**
 * Displays a stable pagination indicator with a subtle active-state
 * transition without shifting the surrounding dots.
 */
/**
 * Displays a subtle pagination indicator for the current gallery photo.
 */
function AnimatedPaginationDot({ isActive }: AnimatedPaginationDotProps) {
  const opacity = useSharedValue(isActive ? 1 : 0.4);

  useEffect(() => {
    opacity.value = withTiming(isActive ? 1 : 0.4, {
      duration: 150,
    });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="mx-1 h-1.5 w-1.5 rounded-full"
      style={[
        animatedStyle,
        {
          backgroundColor: isActive ? theme.extends.colors.brand : "#FFFFFF",
        },
      ]}
    />
  );
}

/**
 * Provides a reusable fullscreen photo viewer with horizontal paging,
 * pinch-to-zoom, panning, double-tap zoom, categories, and pagination.
 */
export default function FullScreenPhotoViewer({
  photos,
  visible,
  initialIndex = 0,
  onClose,
  headerContent,
}: Props) {
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList<PhotoViewerItem>>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  const safeInitialIndex = useMemo(
    () => Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),
    [initialIndex, photos.length],
  );

  useEffect(() => {
    if (!visible || photos.length === 0) {
      return;
    }

    setCurrentIndex(safeInitialIndex);
    setIsZoomed(false);

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: safeInitialIndex,
        animated: false,
      });
    });
  }, [visible, safeInitialIndex, photos.length]);

  if (photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  const categoryLabel = currentPhoto?.category
    ? (PHOTO_CATEGORY_LABELS[currentPhoto.category] ?? currentPhoto.category)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden backgroundColor="black" barStyle="light-content" />

      <View className="flex-1 bg-black">
        {/* Header */}
        {/* Header */}
        <View
          className="absolute left-0 right-0 z-20 flex-row items-center px-5"
          style={{ paddingTop: insets.top + 12 }}
        >
          {/* Close */}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/45 cursor-pointer active:opacity-70"
          >
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </Pressable>

          {/* Custom header content */}
          {headerContent && (
            <View className="ml-3 flex-1">{headerContent}</View>
          )}

          {/* Photo counter */}
          <View className="ml-3 rounded-full bg-black/45 px-3 py-1.5">
            <Text className="text-xs font-semibold text-white">
              {currentIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>

        {/* Photo pager */}
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(photo, index) => `${photo.uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isZoomed}
          initialNumToRender={2}
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            );

            setCurrentIndex(index);
            setIsZoomed(false);
          }}
          renderItem={({ item }) => (
            <ZoomablePhoto photo={item} onZoomStateChange={setIsZoomed} />
          )}
        />

        {/* Bottom photo metadata */}
        <View
          className="absolute left-0 right-0 items-center"
          pointerEvents="none"
          style={{
            bottom: insets.bottom + 20,
          }}
        >
          {/* Category */}
          {categoryLabel && (
            <View className="mb-3 rounded-full bg-black/55 px-3.5 py-1.5">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                {categoryLabel}
              </Text>
            </View>
          )}

          {/* Pagination dots */}
          {photos.length > 1 && (
            <View className="flex-row items-center rounded-full bg-black/35 px-2.5 py-1.5">
              {photos.map((photo, index) => (
                <AnimatedPaginationDot
                  key={`${photo.uri}-dot-${index}`}
                  isActive={index === currentIndex}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
