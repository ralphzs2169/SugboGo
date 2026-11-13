import { zodResolver } from "@hookform/resolvers/zod";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { FormProvider, useForm } from "react-hook-form";

import Button from "@/shared/components/Button";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import { useMerchantRegistrationStore } from "../../../stores/merchantRegistrationStore";
import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import ArrivalLandmarkField from "../landmark/ArrivalLandmarkField";

const mockDismiss = jest.fn();
let mockOnDismiss: (() => void) | undefined;

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useIsFocused: () => true,
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { useImperativeHandle, useState } =
    jest.requireActual<typeof import("react")>("react");
  const { View, ScrollView } = jest.requireActual("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: ScrollView,
    BottomSheetModal: ({
      ref,
      onDismiss,
      children,
    }: {
      ref: React.Ref<{ present: () => void; dismiss: () => void }>;
      onDismiss: () => void;
      children: React.ReactNode;
    }) => {
      const [open, setOpen] = useState(false);
      useImperativeHandle(ref, () => ({
        present: () => setOpen(true),
        dismiss: () => {
          mockDismiss();
          setOpen(false);
        },
      }));
      mockOnDismiss = onDismiss;
      return open ? <View>{children}</View> : null;
    },
  };
});
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: { current: { present: () => void } }) =>
    ref.current.present(),
}));

const bakery: BusinessLandmark = {
  id: "1",
  name: "Bakery",
  address: "Cebu City",
  latitude: 10.31,
  longitude: 123.9,
  source: "google",
};
const plaza: BusinessLandmark = {
  ...bakery,
  id: "2",
  name: "Roadside plaza",
  address: "Lahug",
};

function Form({ onValidate }: { onValidate?: (valid: boolean) => void }) {
  const form = useForm({
    resolver: zodResolver(merchantRegistrationSchema),
    defaultValues: {
      ...MERCHANT_REGISTRATION_DEFAULT_VALUES,
      landmarks: useMerchantRegistrationStore.getState().selectedLandmarks,
    },
  });
  return (
    <FormProvider {...form}>
      <ArrivalLandmarkField
        registerErrorScrollTarget={() => ({
          ref: () => {},
          onLayout: () => {},
        })}
      />
      <Button
        title="Continue"
        onPress={async () => {
          onValidate?.(await form.trigger("landmarks"));
        }}
      />
    </FormProvider>
  );
}

describe("registration arrival landmark field", () => {
  beforeEach(() => {
    useMerchantRegistrationStore.getState().reset();
    useMerchantRegistrationStore.getState().setSelectedLandmarks([bakery, plaza]);
  });

  it("keeps directions for each landmark when switching or choosing none", async () => {
    const screen = await render(<Form />);
    await fireEvent.press(screen.getByRole("button", { name: /Choose landmark/ }));
    expect(
      screen.getByRole("radio", { name: "No arrival landmark", checked: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: /Bakery/ }));
    await fireEvent.changeText(
      screen.getByLabelText("Walking directions to your entrance"),
      "Walk to the green gate.",
    );

    await fireEvent.press(screen.getByRole("button", { name: /optional.*Bakery/ }));
    await fireEvent.press(screen.getByRole("radio", { name: /Roadside plaza/ }));
    expect(
      screen.getByLabelText("Walking directions to your entrance"),
    ).toHaveDisplayValue("");

    await fireEvent.press(
      screen.getByRole("button", { name: /optional.*Roadside plaza/ }),
    );
    await fireEvent.press(
      screen.getByRole("radio", { name: "No arrival landmark" }),
    );
    expect(screen.queryByLabelText("Walking directions to your entrance")).toBeNull();
    expect(
      useMerchantRegistrationStore.getState().selectedLandmarks.some(
        (landmark) => landmark.is_arrival_point || landmark.access_directions,
      ),
    ).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: /Choose landmark/ }));
    await fireEvent.press(screen.getByRole("radio", { name: /Bakery/ }));
    expect(screen.getByDisplayValue("Walk to the green gate.")).toBeTruthy();
  });

  it("places the required error on the directions field and clears it when corrected", async () => {
    const onValidate = jest.fn();
    const screen = await render(<Form onValidate={onValidate} />);
    await fireEvent.press(screen.getByRole("button", { name: /Choose landmark/ }));
    await fireEvent.press(screen.getByRole("radio", { name: /Bakery/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    const directions = screen.getByLabelText(
      "Walking directions to your entrance",
    );
    expect(onValidate).toHaveBeenLastCalledWith(false);
    expect(directions).toHaveProp(
      "accessibilityHint",
      "Required field. Error: Enter walking directions.",
    );
    await fireEvent.changeText(directions, "Enter the green gate.");
    expect(directions).toHaveProp("accessibilityHint", "Required field.");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onValidate).toHaveBeenLastCalledWith(true);
  });

  it("opens the custom picker after the sheet closes, even with no suggestions", async () => {
    useMerchantRegistrationStore.getState().setSelectedLandmarks([]);
    const screen = await render(<Form />);
    await fireEvent.press(screen.getByRole("button", { name: /Choose landmark/ }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Add a custom landmark" }),
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    await act(() => mockOnDismiss?.());
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/merchant-registration/landmarks-picker",
      params: { purpose: "arrival" },
    });
  });

  it("explains how to add a custom landmark when the list is full", async () => {
    useMerchantRegistrationStore.getState().setSelectedLandmarks(
      Array.from({ length: 5 }, (_, index) => ({
        ...bakery,
        id: String(index),
      })),
    );
    const screen = await render(<Form />);
    await fireEvent.press(screen.getByRole("button", { name: /Choose landmark/ }));
    expect(
      screen.getByRole("button", { name: "Add a custom landmark" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Remove a place from Nearby Landmarks to add a custom landmark.",
      ),
    ).toBeTruthy();
  });
});
