import { act, renderHook } from "@testing-library/react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import useRegistrationValidation from "../useRegistrationValidation";

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

it("blocks Step 2 until the selected arrival landmark has entrance directions", async () => {
  const { result } = await renderHook(() => {
    const form = useForm({
      resolver: zodResolver(merchantRegistrationSchema),
      defaultValues: {
        ...MERCHANT_REGISTRATION_DEFAULT_VALUES,
        province: "Cebu",
        city: "Cebu City",
        barangay: "Lahug",
        streetAddress: "Sample Street",
        latitude: 10.31,
        longitude: 123.9,
        landmarks: [
          {
            id: "1",
            name: "Bakery",
            address: "Cebu City",
            latitude: 10.31,
            longitude: 123.9,
            source: "custom",
            is_arrival_point: true,
            access_directions: "",
          },
        ],
      },
    });
    return { form, ...useRegistrationValidation({ currentStep: 2, form }) };
  });
  await act(async () => {
    expect(await result.current.validateCurrentStep()).toBe(false);
  });
  await act(async () => {
    result.current.form.setValue(
      "landmarks.0.access_directions",
      "Enter the green gate.",
    );
    expect(await result.current.validateCurrentStep()).toBe(true);
  });
});
