import { BottomSheetModal } from "@gorhom/bottom-sheet";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { ProfilePictureAction } from "@/features/profile/types/profile.types";
import { PROFILE_PICTURE_OPTIONS } from "@/features/profile/constants/profilePictureOptions";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  isShowingCustomProfilePicture: boolean;
  hasSelectedImage: boolean;
  onChoosePhoto: () => void;
  onTakePhoto: () => void;
  onRemovePicture: () => void;
};

/**
 * ProfilePictureBottomSheet provides a bottom sheet interface for selecting profile picture actions.
 * It displays options to choose a photo, take a photo, or remove the current photo based on the user's state.
 */
export function ProfilePictureBottomSheet({
  sheetRef,
  isShowingCustomProfilePicture,
  hasSelectedImage,
  onChoosePhoto,
  onTakePhoto,
  onRemovePicture,
}: Props) {
  const canRemovePicture = isShowingCustomProfilePicture || hasSelectedImage;

  const options = canRemovePicture
    ? PROFILE_PICTURE_OPTIONS
    : PROFILE_PICTURE_OPTIONS.filter(
        (option) => option.value !== "remove_photo",
      );

  function handleSelect(value: string) {
    switch (value as ProfilePictureAction) {
      case "choose_photo":
        onChoosePhoto();
        break;

      case "take_photo":
        onTakePhoto();
        break;

      case "remove_photo":
        onRemovePicture();
        break;
    }
  }

  return (
    <SelectionBottomSheet
      sheetRef={sheetRef}
      title="Profile Picture"
      options={options}
      onSelect={handleSelect}
    />
  );
}
