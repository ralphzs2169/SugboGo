import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { TextInput } from "react-native";

import RegistrationStepContent from "../RegistrationStepContent";
import { getDuplicateWarning } from "../../../api/merchantApplication.service";
import type { ApplicationDetailResponse } from "../../../types/registration/registrationApi.types";

const mockLocationState = {
  selectedLocation: null,
  selectedAddress: null,
  selectedLandmarks: [],
  addressLoadFailed: false,
  addressLoadFailures: {},
};
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: 42 } }),
}));
jest.mock("../../../stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: (selector: (state: unknown) => unknown) =>
    selector(mockLocationState),
}));
jest.mock("../../../api/merchantApplication.service", () => ({
  getDuplicateWarning: jest.fn(),
}));
jest.mock("@/shared/components/form/RHFFormInput", () => () => null);
jest.mock("../landmark/LandmarksSection", () => () => null);
jest.mock("../location/LocationPickerMap", () => {
  const { Text } = jest.requireActual("react-native");
  return function LocationForm() {
    return <Text testID="location-form">Location form</Text>;
  };
});
jest.mock("../steps/BusinessIdentityStep", () => () => null);
jest.mock("../steps/OperatingHoursStep", () => () => null);
jest.mock("../steps/BusinessPhotosStep", () => () => null);
jest.mock("../steps/VerificationDocumentsStep", () => () => null);
jest.mock("../review/sections/ReviewBusinessIdentity", () => {
  const { Text } = jest.requireActual("react-native");
  return function IdentitySummary() {
    return <Text testID="application-summary">Application summary</Text>;
  };
});
jest.mock("../review/sections/ReviewBusinessLocation", () => () => null);
jest.mock("../review/sections/ReviewOperatingHours", () => () => null);
jest.mock("../review/sections/ReviewBusinessPhotos", () => () => null);
jest.mock("../review/sections/ReviewVerificationDocuments", () => () => null);
jest.mock("../ResubmissionChecklist", () => () => null);
const mockEditSection = jest.fn();

const application = {
  identity: { business_name: "Sugbo Bistro" },
  location: {
    province: "Cebu",
    city: "Cebu City",
    barangay: "Lahug",
    street_address: "Gorordo Avenue",
    unit: "4B",
    latitude: 10.3157,
    longitude: 123.8854,
  },
} as ApplicationDetailResponse;

function WizardStep({ step }: { step: number }) {
  const form = useForm({
    defaultValues: {
      businessName: "Sugbo Bistro",
      province: "Cebu",
      city: "Cebu City",
      barangay: "Lahug",
      streetAddress: "Gorordo Avenue",
      unit: "4B",
      latitude: 10.3157,
      longitude: 123.8854,
    },
  });
  return (
    <FormProvider {...form}>
      <TextInput
        testID="edit-name"
        onChangeText={(value) => form.setValue("businessName", value)}
      />
      <RegistrationStepContent
        application={application}
        currentStep={step}
        clusters={[]}
        categories={[]}
        isLoadingClusters={false}
        isLoadingCategories={false}
        clustersError={null}
        categoriesError={null}
        refetchClusters={() => {}}
        refetchCategories={() => {}}
        onEditSection={mockEditSection}
        isResubmission={false}
        feedback={[]}
        registerErrorScrollTarget={() => ({})}
      />
    </FormProvider>
  );
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Harness({ step }: { step: number }) {
    return (
      <QueryClientProvider client={client}>
        <WizardStep step={step} />
      </QueryClientProvider>
    );
  };
}

it("places the warning below the location description and above the form, not on unrelated steps", async () => {
  (getDuplicateWarning as jest.Mock).mockResolvedValue({
    success: true,
    data: { evaluated: true, possible_duplicate: true },
  });
  const Harness = setup();
  const screen = await render(<Harness step={2} />);
  await waitFor(() =>
    expect(screen.getByText("Possible existing business")).toBeTruthy(),
  );
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf("Place the pin as close as possible")).toBeLessThan(
    tree.indexOf("Possible existing business"),
  );
  expect(tree.indexOf("Possible existing business")).toBeLessThan(
    tree.indexOf("location-form"),
  );
  for (const step of [1, 3, 4, 5]) {
    await screen.rerender(<Harness step={step} />);
    expect(screen.queryByText("Possible existing business")).toBeNull();
  }
  expect(getDuplicateWarning).toHaveBeenCalledTimes(1);
});

it("checks on first entering Review and offers the existing location edit navigation", async () => {
  (getDuplicateWarning as jest.Mock).mockResolvedValue({
    success: true,
    data: { evaluated: true, possible_duplicate: true },
  });
  const Harness = setup();
  const screen = await render(<Harness step={5} />);
  expect(getDuplicateWarning).not.toHaveBeenCalled();
  await screen.rerender(<Harness step={6} />);
  await waitFor(() =>
    expect(screen.getByText("Possible existing business")).toBeTruthy(),
  );
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf("Check your information before submitting")).toBeLessThan(
    tree.indexOf("Possible existing business"),
  );
  expect(tree.indexOf("Possible existing business")).toBeLessThan(
    tree.indexOf("application-summary"),
  );
  await fireEvent.press(screen.getByText("Review location"));
  expect(mockEditSection).toHaveBeenCalledWith(2);
  await screen.rerender(<Harness step={6} />);
  expect(getDuplicateWarning).toHaveBeenCalledTimes(1);
});

it("shows uncertainty on Review while keeping the summary available", async () => {
  (getDuplicateWarning as jest.Mock).mockRejectedValue(
    new Error("Network unavailable"),
  );
  const Harness = setup();
  const screen = await render(<Harness step={6} />);
  await waitFor(() =>
    expect(screen.getByText("Duplicate check unavailable")).toBeTruthy(),
  );
  expect(screen.getByText(/You can still continue/)).toBeTruthy();
  expect(screen.getByTestId("application-summary")).toBeTruthy();
  expect(screen.getByText("Try Again")).toBeTruthy();
});

it("discards a Review response after relevant details change", async () => {
  let finish: (value: unknown) => void = () => {};
  (getDuplicateWarning as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const Harness = setup();
  const screen = await render(<Harness step={6} />);
  await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(1));
  await fireEvent.changeText(screen.getByTestId("edit-name"), "Changed name");
  await act(async () =>
    finish({
      success: true,
      data: { evaluated: true, possible_duplicate: true },
    }),
  );
  expect(screen.queryByText("Possible existing business")).toBeNull();
  expect(screen.queryByText("Review location")).toBeNull();
});

it("discards a late warning after navigating away and checks fresh saved evidence on return", async () => {
  let finish: (value: unknown) => void = () => {};
  (getDuplicateWarning as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({
      success: true,
      data: { evaluated: true, possible_duplicate: false },
    });
  const Harness = setup();
  const screen = await render(<Harness step={2} />);
  await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(1));
  await screen.rerender(<Harness step={3} />);
  await act(async () =>
    finish({
      success: true,
      data: { evaluated: true, possible_duplicate: true },
    }),
  );
  expect(screen.queryByText("Possible existing business")).toBeNull();
  await screen.rerender(<Harness step={2} />);
  await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Possible existing business")).toBeNull();
});

it("hides an in-flight result when relevant form details no longer match the saved draft", async () => {
  let finish: (value: unknown) => void = () => {};
  (getDuplicateWarning as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const Harness = setup();
  const screen = await render(<Harness step={2} />);
  await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(1));
  await fireEvent.changeText(
    screen.getByTestId("edit-name"),
    "Unsaved different business",
  );
  await act(async () =>
    finish({
      success: true,
      data: { evaluated: true, possible_duplicate: true },
    }),
  );
  expect(screen.queryByText("Possible existing business")).toBeNull();
  expect(getDuplicateWarning).toHaveBeenCalledTimes(1);
});

it("does not flash a cached positive warning while refreshing a revisited location", async () => {
  let finish: (value: unknown) => void = () => {};
  (getDuplicateWarning as jest.Mock)
    .mockResolvedValueOnce({
      success: true,
      data: { evaluated: true, possible_duplicate: true },
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const Harness = setup();
  const screen = await render(<Harness step={2} />);
  await waitFor(() =>
    expect(screen.getByText("Possible existing business")).toBeTruthy(),
  );
  await screen.rerender(<Harness step={3} />);
  await screen.rerender(<Harness step={2} />);
  await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Possible existing business")).toBeNull();
  await act(async () =>
    finish({
      success: true,
      data: { evaluated: true, possible_duplicate: false },
    }),
  );
  expect(screen.queryByText("Possible existing business")).toBeNull();
});
