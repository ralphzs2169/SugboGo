import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import Button from "@/shared/components/Button";
import FixedFooter from "@/shared/components/FixedFooter";

type Props = {
  isOwnBusiness: boolean;
};

/** Keeps the existing fixed management CTA for a business owner. */
export default function BusinessProfileFooter({ isOwnBusiness }: Props) {
  if (!isOwnBusiness) {
    return null;
  }

  return (
    <FixedFooter>
      <Button
        title="Manage My Business"
        onPress={() => router.push("/(merchant)/(tabs)/profile")}
        icon={
          <MaterialCommunityIcons
            name="cog-outline"
            size={18}
            color="white"
          />
        }
        rounded="full"
        className="w-full"
        fontClassName="text-sm font-semibold"
      />
    </FixedFooter>
  );
}
