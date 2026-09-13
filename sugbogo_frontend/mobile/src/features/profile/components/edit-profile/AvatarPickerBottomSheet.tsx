import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import {
  AVATAR_KEYS,
  BUILT_IN_AVATARS,
  type AvatarKey,
} from "@/shared/constants/avatars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  selectedAvatarKey: AvatarKey | null;
  onSelect: (avatarKey: AvatarKey) => void;
};

export default function AvatarPickerBottomSheet({
  sheetRef,
  selectedAvatarKey,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  function handleSelect(avatarKey: AvatarKey) {
    onSelect(avatarKey);
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["52%"]}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: "white",
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: "#D1D5DB",
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView
        className="px-6"
        style={{
          paddingBottom: Math.max(insets.bottom, 32),
        }}
      >
        <View className="flex-row items-center justify-between border-b border-gray-100 pb-4">
          <View>
            <AppText weight="bold" className="text-lg  text-gray-900">
              Choose SugboGo Avatar
            </AppText>
            <AppText className="mt-1 text-sm text-text-secondary">
              Pick the explorer avatar that feels like you.
            </AppText>
          </View>

          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close avatar picker"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-gray-100"
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>

        <View className="mt-5 flex-row flex-wrap justify-between gap-y-5">
          {AVATAR_KEYS.map((avatarKey) => {
            const selected = selectedAvatarKey === avatarKey;

            return (
              <Pressable
                key={avatarKey}
                onPress={() => handleSelect(avatarKey)}
                accessibilityRole="radio"
                accessibilityLabel="SugboGo avatar option"
                accessibilityState={{ checked: selected }}
                className="w-[30%] items-center"
              >
                <View
                  className={`rounded-full border-4 p-0.5 ${
                    selected ? "border-text-info" : "border-transparent"
                  }`}
                >
                  <Image
                    source={BUILT_IN_AVATARS[avatarKey]}
                    style={{ width: 76, height: 76, borderRadius: 38 }}
                    contentFit="cover"
                  />
                </View>

                {selected ? (
                  <View className="absolute right-1 top-0 h-7 w-7 items-center bg-success  justify-center rounded-full bg-primary">
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color="white"
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
