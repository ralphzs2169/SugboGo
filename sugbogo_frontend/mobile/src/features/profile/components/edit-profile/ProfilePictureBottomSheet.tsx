import { BottomSheetModal } from "@gorhom/bottom-sheet";

import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { ProfilePictureAction } from "@/features/profile/types/profile.types";
import { PROFILE_PICTURE_OPTIONS } from "@/features/profile/constants/profilePictureOptions";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  isShowingCustomProfilePicture: boolean;
  onChooseAvatar: () => void;
  onChoosePhoto: () => void;
  onRemovePicture: () => void;
};

/**
 * ProfilePictureBottomSheet provides a bottom sheet interface for selecting profile picture actions.
 * It displays options to choose a photo, take a photo, or remove the current photo based on the user's state.
 */
export function ProfilePictureBottomSheet({
  sheetRef,
  isShowingCustomProfilePicture,
  onChooseAvatar,
  onChoosePhoto,
  onRemovePicture,
}: Props) {
  const options = isShowingCustomProfilePicture
    ? PROFILE_PICTURE_OPTIONS
    : PROFILE_PICTURE_OPTIONS.filter(
        (option) => option.value !== "remove_photo",
      );

  function handleSelect(value: string) {
    switch (value as ProfilePictureAction) {
      case "choose_avatar":
        onChooseAvatar();
        break;

      case "upload_photo":
        onChoosePhoto();
        break;

      case "remove_photo":
        onRemovePicture();
        break;
    }
  }

  return (
    <SelectionBottomSheet
      sheetRef={sheetRef}
      title="Profile picture actions"
      options={options}
      onSelect={handleSelect}
    />
  );
}
