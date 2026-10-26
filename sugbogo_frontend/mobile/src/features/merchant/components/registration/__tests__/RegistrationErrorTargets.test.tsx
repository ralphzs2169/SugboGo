import { useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";
import { ScrollView, View } from "react-native";

import Button from "@/shared/components/Button";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import useRegistrationErrorScroll from "../../../hooks/registration/useRegistrationErrorScroll";
import { useMerchantRegistrationStore } from "../../../stores/merchantRegistrationStore";
import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import type { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import BusinessIdentityStep from "../steps/BusinessIdentityStep";
import BusinessLocationStep from "../steps/BusinessLocationStep";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock(
  "@/shared/components/bottom-sheets/SelectionBottomSheet",
  () => () => null,
);
jest.mock("../specialty-tags/SpecialtyTagsSection", () => () => null);
jest.mock("../landmark/LandmarksSection", () => () => null);
jest.mock("../location/LocationPickerMap", () => () => null);
jest.mock("../DuplicateBusinessWarning", () => () => null);
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const scrollTo = jest.fn();
type TargetField = "website" | "businessEmail" | "streetAddress";

function RegistrationForm({ field }: { field: TargetField }) {
  const form = useForm({
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
    resolver: zodResolver(merchantRegistrationSchema),
  });
  const scrollRef = useRef({ scrollTo } as unknown as ScrollView);
  const { registerErrorScrollTarget, scrollToFirstError } =
    useRegistrationErrorScroll({
      scrollRef,
      currentStep: field === "streetAddress" ? 2 : 1,
    });

  // Supply native layout measurements; all field rendering and validation is real.
  const registerTarget: typeof registerErrorScrollTarget = (...names) => {
    const target = registerErrorScrollTarget(...names);
    return {
      ...target,
      testID: `target-${names[0]}`,
      ref: () =>
        target.ref({
          measureLayout: (
            _relative: View,
            success: (x: number, y: number) => void,
          ) => {
            success(0, 600);
          },
        } as View),
    };
  };

  async function continueStep() {
    if (!(await form.trigger(field))) {
      scrollToFirstError(() => ({ [field]: form.getFieldState(field).error }));
    }
  }

  return (
    <FormProvider {...form}>
      {field === "streetAddress" ? (
        <BusinessLocationStep registerErrorScrollTarget={registerTarget} />
      ) : (
        <BusinessIdentityStep
          clusters={[]}
          categories={[]}
          isLoadingClusters={false}
          isLoadingCategories={false}
          clustersError={null}
          categoriesError={null}
          registerErrorScrollTarget={registerTarget}
        />
      )}
      <Button title="Continue" onPress={() => void continueStep()} />
    </FormProvider>
  );
}

describe("registration validation scroll targets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMerchantRegistrationStore.getState().reset();
    useMerchantRegistrationStore.setState({
      selectedLocation: {
        latitude: 10.3,
        longitude: 123.9,
      } as BusinessLocation,
    });
  });

  it.each([
    ["website", "https://...", "invalid", "Please enter a valid website URL."],
    [
      "businessEmail",
      "business@example.com",
      "invalid",
      "Please enter a valid email.",
    ],
    [
      "streetAddress",
      "e.g. Gov. Cuenco Avenue",
      "a",
      "Street address must be at least 5 characters.",
    ],
  ] as const)(
    "scrolls to invalid %s and retains its inline error",
    async (field, placeholder, value, message) => {
      const screen = await render(<RegistrationForm field={field} />);
      await fireEvent.changeText(
        screen.getByPlaceholderText(placeholder),
        value,
      );
      await fireEvent.press(screen.getByText("Continue"));
      expect(screen.getByText(message)).toBeTruthy();
      await fireEvent(screen.getByTestId(`target-${field}`), "layout", {
        nativeEvent: { layout: { x: 0, y: 600, width: 300, height: 80 } },
      });
      await waitFor(() =>
        expect(scrollTo).toHaveBeenCalledWith({ y: 576, animated: true }),
      );
      expect(screen.getByDisplayValue(value)).toBeTruthy();
      expect(screen.getByText(message)).toBeTruthy();
    },
  );
});
