import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LayoutChangeEvent } from "react-native";

import Button from "@/shared/components/Button";
import FixedFooter from "@/shared/components/FixedFooter";

import useOpenBusinessManagement from "../../hooks/useOpenBusinessManagement";

type Props = {
  isOwnBusiness: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Shows the fixed owner action with feedback while Merchant access is checked. */
export default function BusinessProfileFooter({
  isOwnBusiness,
  onLayout,
}: Props) {
  const { isOpening, openBusinessManagement } = useOpenBusinessManagement();

  if (!isOwnBusiness) {
    return null;
  }

  return (
    <FixedFooter onLayout={onLayout}>
      <Button
        title="Manage My Business"
        onPress={openBusinessManagement}
        loading={isOpening}
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
