import { BottomSheetModal } from "@gorhom/bottom-sheet";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import {
  MERCHANT_COVER_PHOTO_OPTIONS,
  MerchantCoverPhotoAction,
} from "@/features/merchant/constants/business-profile/merchantCoverPhotoOptions";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onChoosePhoto: () => void;
  onTakePhoto: () => void;
};

/**
 * Provides image-selection actions for changing a merchant's business cover photo.
 *
 * Allows the merchant to select an existing image or capture a new cover photo.
 */
export default function MerchantCoverPhotoBottomSheet({
  sheetRef,
  onChoosePhoto,
  onTakePhoto,
}: Props) {
  function handleSelect(value: string) {
    switch (value as MerchantCoverPhotoAction) {
      case "choose_photo":
        onChoosePhoto();
        break;

      case "take_photo":
        onTakePhoto();
        break;
    }
  }

  return (
    <SelectionBottomSheet
      sheetRef={sheetRef}
      title="Business Cover Photo"
      options={MERCHANT_COVER_PHOTO_OPTIONS}
      onSelect={handleSelect}
    />
  );
}
