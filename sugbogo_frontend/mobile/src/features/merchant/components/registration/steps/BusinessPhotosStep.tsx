import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFormContext } from "react-hook-form";
import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";

export default function BusinessPhotosStep() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const photos = watch("businessPhotos") ?? {
    storefront: null,
    interior: [],
    products: [],
    additional: [],
  };

  return (
    <View className="bg-surface px-6 py-5">
      <View className="mb-5">
        <Text className="text-2xl font-bold text-text-primary">
          Business Photos
        </Text>

        <Text className="mt-1 text-sm text-text-secondary">
          Add photos that help explorers recognize and discover your business.
        </Text>
      </View>

      <PhotoSection
        icon="storefront-outline"
        title="Storefront Photo"
        description="Upload a clear photo of your business exterior."
        required
        count={photos.storefront ? 1 : 0}
      />

      <PhotoSection
        icon="image-outline"
        title="Interior Photos"
        description="Show your space, seating, products, or setup."
        count={photos.interior.length}
      />

      <PhotoSection
        icon="food-outline"
        title="Products & Services"
        description="Show what your business offers."
        count={photos.products.length}
      />

      <PhotoSection
        icon="image-multiple-outline"
        title="Additional Photos"
        description="Add any other photos you want explorers to see."
        count={photos.additional.length}
      />
    </View>
  );
}

type PhotoSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  required?: boolean;
  count: number;
};

function PhotoSection({
  icon,
  title,
  description,
  required,
  count,
}: PhotoSectionProps) {
  return (
    <Pressable className="mb-4 rounded-xl border border-border-primary px-4 py-4">
      <View className="flex-row items-center">
        <MaterialCommunityIcons name={icon} size={24} color="#F27F0D" />

        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-text-primary">
            {title}
            {required && <Text className="text-brand"> *</Text>}
          </Text>

          <Text className="mt-1 text-sm text-text-secondary">
            {description}
          </Text>
        </View>

        <View className="rounded-full bg-border/40 px-3 py-1">
          <Text className="text-xs font-semibold text-text-secondary">
            {count} added
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-center rounded-lg border border-dashed border-border-primary py-5">
        <MaterialCommunityIcons
          name="plus-circle-outline"
          size={22}
          color="#999999"
        />

        <Text className="ml-2 text-sm font-medium text-text-secondary">
          Add Photo
        </Text>
      </View>
    </Pressable>
  );
}
