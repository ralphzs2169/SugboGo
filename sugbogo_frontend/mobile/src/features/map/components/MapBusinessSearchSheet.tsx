import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import BusinessCard from "@/features/explore/components/new-businesses/BusinessCard";
import type { ExploreBusiness } from "@/features/explore/types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import useMapBusinessSearch from "../hooks/useMapBusinessSearch";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onBusinessSelect: (business: ExploreBusiness) => void;
};

/**
 * Adapts Registration's near-full-height search interaction for SugboGo businesses.
 * Search remains global and independent of the camera and applied map filters.
 */
export default function MapBusinessSearchSheet({
  sheetRef,
  onBusinessSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const isSheetOpen = useRef(false);
  const selectedResult = useRef(false);
  const pendingSelection = useRef<ExploreBusiness | null>(null);
  const endReached = useRef(false);
  const results = useMapBusinessSearch(query, isOpen);

  useQueryErrorNotification({
    error: results.error,
    toastId: "map-business-search",
    title: "Could not search businesses",
    fallbackMessage: "Please try again.",
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpen.current) {
          return false;
        }

        Keyboard.dismiss();
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [sheetRef]);

  const close = () => {
    Keyboard.dismiss();
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["94%"]}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.background,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
        />
      )}
      onChange={(index) => {
        const wasOpen = isSheetOpen.current;
        isSheetOpen.current = index >= 0;
        setIsOpen(index >= 0);
        if (index >= 0 && !wasOpen) {
          selectedResult.current = false;
          pendingSelection.current = null;
        }
      }}
      onDismiss={() => {
        isSheetOpen.current = false;
        setIsOpen(false);
        setQuery("");
        Keyboard.dismiss();
        const selectedBusiness = pendingSelection.current;
        pendingSelection.current = null;
        if (selectedBusiness) {
          onBusinessSelect(selectedBusiness);
        }
      }}
    >
      {/* Search input and explicit dismissal */}
      <View className="px-5 pb-4 pt-2">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" className="text-xl text-text-primary">
            Find a business
          </AppText>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close business search"
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
        <AppText className="text-sm text-text-secondary">
          Find registered businesses across Cebu. Map filters do not apply here.
        </AppText>
        <View className="mt-4 min-h-12 flex-row items-center rounded-xl border border-border-primary bg-surface px-3">
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
          <BottomSheetTextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            maxLength={200}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="Business, category, or specialty"
            accessibilityLabel="Search SugboGo businesses"
            className="ml-3 min-h-12 flex-1 text-sm text-text-primary"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear business search"
              className="h-12 w-12 cursor-pointer items-center justify-center active:opacity-70"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Registered businesses and localized recovery */}
      <BottomSheetFlatList<ExploreBusiness>
        data={results.businesses}
        keyExtractor={(business) => String(business.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 32),
          gap: 12,
        }}
        renderItem={({ item }) => (
          <BusinessCard
            business={item}
            variant="compact"
            distance={null}
            distanceAccuracy={null}
            onPress={() => {
              if (selectedResult.current) {
                return;
              }
              selectedResult.current = true;
              pendingSelection.current = item;
              close();
            }}
          />
        )}
        ListEmptyComponent={
          results.isPending ? (
            <View className="items-center py-8">
              <ActivityIndicator color={theme.extends.colors.brand} />
              <AppText className="mt-3 text-sm text-text-secondary">
                Searching businesses…
              </AppText>
            </View>
          ) : results.error ? (
            <ErrorState
              size="section"
              title="Could not search businesses"
              description="Try searching again."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void results.refetch()}
            />
          ) : (
            <AppText className="px-4 py-8 text-center text-sm text-text-secondary">
              {results.hasQuery
                ? "No businesses found. Try another name, category, or specialty."
                : "Enter at least two characters to find a business."}
            </AppText>
          )
        }
        ListFooterComponent={
          results.error && results.businesses.length > 0 ? (
            <ErrorState
              size="section"
              title="Could not load more businesses"
              description="Retry loading these search results."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void results.refetch()}
            />
          ) : results.isFetchingNextPage ? (
            <View className="items-center py-5">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : results.businesses.length > 0 && !results.hasNextPage ? (
            <EndOfListMessage description="You've reached the end of these search results." />
          ) : null
        }
        onMomentumScrollBegin={() => {
          endReached.current = false;
        }}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (
            !endReached.current &&
            results.hasNextPage &&
            !results.isFetching &&
            !results.isPending
          ) {
            endReached.current = true;
            void results.fetchNextPage();
          }
        }}
      />
    </BottomSheetModal>
  );
}
