import { render } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";
import DuplicateBusinessWarning from "../DuplicateBusinessWarning";
import type { ApplicationDetailResponse } from "../../../types/registration/registrationApi.types";

const mockRefetch = jest.fn();
const mockWarning = jest.fn();
let mockState = {
  isPending: false,
  isFetching: false,
  isError: false,
  data: { evaluated: true, possible_duplicate: true },
  refetch: mockRefetch,
};

jest.mock("../../../hooks/registration/useDuplicateWarning", () => ({
  __esModule: true,
  default: (...args: unknown[]) => {
    mockWarning(...args);
    return mockState;
  },
}));

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

function Harness({ name = "Sugbo Bistro" }: { name?: string }) {
  const methods = useForm({
    defaultValues: {
      businessName: name,
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
    <FormProvider {...methods}>
      <DuplicateBusinessWarning application={application} />
    </FormProvider>
  );
}

beforeEach(() => {
  mockState = {
    ...mockState,
    isError: false,
    data: { evaluated: true, possible_duplicate: true },
  };
});

it("renders a saved-evidence warning with no blocking action", async () => {
  const screen = await render(<Harness />);
  expect(screen.getByText("Possible existing business")).toBeTruthy();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});

it("hides stale saved-evidence results while name edits are unsaved", async () => {
  const screen = await render(<Harness name="Changed unsaved name" />);
  expect(screen.queryByText("Possible existing business")).toBeNull();
  expect(mockWarning).not.toHaveBeenCalled();
});

it("shows retryable uncertainty when detection fails", async () => {
  mockState = { ...mockState, isError: true };
  const screen = await render(<Harness />);
  expect(screen.getByText(/couldn’t check/)).toBeTruthy();
  expect(screen.getByText("Try Again")).toBeTruthy();
  expect(screen.queryByText("Possible existing business")).toBeNull();
});
