import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { UseFormReturn } from "react-hook-form";
import { BackHandler } from "react-native";
import { router } from "expo-router";
import type { NavigationAction } from "expo-router/react-navigation";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";
import type { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../constants/registration/defaultValues.constants";
import { useMerchantRegistrationStore } from "../../stores/merchantRegistrationStore";
import MerchantRegistrationScreen from "../MerchantRegistrationScreen";

type FormValues = typeof MERCHANT_REGISTRATION_DEFAULT_VALUES;
let mockForm: UseFormReturn<FormValues>;
let mockHardwareBack: () => boolean | null | undefined;
let mockPrevent: boolean;
let mockRemoval: (event: { data: { action: NavigationAction } }) => void;
let mockApplication: ApplicationDetailResponse | null;
const mockNavigation = { setOptions: jest.fn(), dispatch: jest.fn() };
const mockSaveIdentity = jest.fn();
const mockSaveLocation = jest.fn();
const mockSaveHours = jest.fn();
const mockSavePhotos = jest.fn();
const mockSaveDocuments = jest.fn();
const mockSubmit = jest.fn();
const mockValidate = jest.fn();
let mockNext: () => void;

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    dismissTo: jest.fn(),
  },
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) => {
    jest
      .requireActual<typeof import("react")>("react")
      .useEffect(callback, [callback]);
  },
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (prevent: boolean, callback: typeof mockRemoval) => {
    mockPrevent = prevent;
    mockRemoval = callback;
  },
}));
jest.mock("../../constants/registration/registrationSteps", () => ({
  REGISTRATION_STEPS: [
    "Identity",
    "Location",
    "Hours",
    "Photos",
    "Documents",
    "Review",
  ].map((title) => ({ title })),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../hooks/registration/useCurrentApplication", () => ({
  __esModule: true,
  default: () => ({
    application: mockApplication,
    isLoading: false,
    error: false,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../hooks/registration/useClusters", () => ({
  __esModule: true,
  default: () => ({
    clusters: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../hooks/registration/useCategories", () => ({
  __esModule: true,
  default: () => ({
    categories: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../hooks/registration/useSaveIdentity", () => ({
  __esModule: true,
  default: () => ({ saveIdentity: mockSaveIdentity, isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveLocation", () => ({
  __esModule: true,
  default: () => ({ saveLocation: mockSaveLocation, isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveOperatingHours", () => ({
  __esModule: true,
  default: () => ({ saveOperatingHours: mockSaveHours, isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveApplicationPhotos", () => ({
  __esModule: true,
  default: () => ({ savePhotos: mockSavePhotos, isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveApplicationDocuments", () => ({
  __esModule: true,
  default: () => ({ saveDocuments: mockSaveDocuments, isSaving: false }),
}));
jest.mock("../../hooks/registration/useSubmitApplication", () => ({
  __esModule: true,
  default: () => ({ submit: mockSubmit, isSubmitting: false }),
}));
jest.mock("../../hooks/registration/useRegistrationValidation", () => ({
  __esModule: true,
  default: () => ({ validateCurrentStep: mockValidate }),
}));
jest.mock("../../hooks/registration/useRegistrationErrorScroll", () => ({
  __esModule: true,
  default: () => ({
    registerErrorScrollTarget: () => ({}),
    scrollToFirstError: jest.fn(),
  }),
}));
jest.mock("../../components/registration/ReviewCelebration", () => () => null);
jest.mock("../../components/registration/RegistartionFooter", () => {
  const ActualFooter = jest.requireActual(
    "../../components/registration/RegistartionFooter",
  ).default;
  return function Footer(props: React.ComponentProps<typeof ActualFooter>) {
    mockNext = props.onNext;
    return <ActualFooter {...props} />;
  };
});
jest.mock("../../components/registration/RegistrationLayout", () => {
  const { View } = jest.requireActual("react-native");
  return function MockLayout({ children, stepper, footer }: any) {
    return (
      <View>
        {stepper}
        {children}
        {footer}
      </View>
    );
  };
});
jest.mock("../../components/registration/RegistrationStepper", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockStepper({ currentStep }: { currentStep: number }) {
    return <Text>{`Step ${currentStep}`}</Text>;
  };
});
jest.mock("../../components/registration/RegistrationStepContent", () => {
  const { router } = jest.requireMock("expo-router");
  const { useFormContext } =
    jest.requireActual<typeof import("react-hook-form")>("react-hook-form");
  const { Text, View, Pressable } = jest.requireActual("react-native");
  const Input = jest.requireActual(
    "@/shared/components/form/RHFFormInput",
  ).default;
  const Select = jest.requireActual(
    "@/shared/components/form/RHFFormSelect",
  ).default;
  const TextArea = jest.requireActual(
    "@/shared/components/form/RHFFormTextArea",
  ).default;
  return function MockSteps({ currentStep, onEditSection, reviewValues }: any) {
    const form = useFormContext<FormValues>();
    mockForm = form;
    if (currentStep === 6) {
      return (
        <View>
          <Text>{`Review: ${reviewValues.businessName}`}</Text>
          {[1, 2, 3, 4, 5].map((step) => (
            <Pressable
              key={step}
              accessibilityRole="button"
              accessibilityLabel={`Edit section ${step}`}
              onPress={() => onEditSection(step)}
            >
              <Text>{`Edit section ${step}`}</Text>
            </Pressable>
          ))}
        </View>
      );
    }
    return (
      <View>
        <Input
          name="businessName"
          label="Business Name"
          placeholder="Business name"
        />
        <TextArea
          name="businessDescription"
          label="Description"
          placeholder="Description"
        />
        <Select
          name="representativeRole"
          label="Role"
          options={[{ label: "Owner", value: "owner" }]}
          onSelectPress={jest.fn()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open location picker"
          disabled={form.formState.disabled}
          onPress={() =>
            router.push("/(explorer)/merchant-registration/location-picker")
          }
        >
          <Text>Open location picker</Text>
        </Pressable>
      </View>
    );
  };
});
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function MockConfirm({
    visible,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: any) {
    return visible ? (
      <View>
        <Text>{title}</Text>
        {message}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmText}
          onPress={onConfirm}
        >
          <Text>{confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelText}
          onPress={onCancel}
        >
          <Text>{cancelText}</Text>
        </Pressable>
      </View>
    ) : null;
  };
});
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

function application(highest = 5): ApplicationDetailResponse {
  return {
    id: 1,
    status: "draft",
    highest_completed_step: highest,
    submitted_at: null,
    reviewed_at: null,
    submission_count: 0,
    latest_review: null,
    created_at: "2026-10-26",
    updated_at: "2026-10-26",
    review_sla_min_business_days: 3,
    review_sla_max_business_days: 5,
    identity: {
      business_name: "Saved Cafe",
      business_description: "A lovely neighborhood cafe",
      contact_number: "09123456789",
      business_email: "",
      website: "",
      representative_name: "Ana Cruz",
      representative_role: "owner",
      business_cluster_id: 1,
      business_cluster_name: "Food",
      business_category_id: 2,
      business_category_name: "Cafe",
      specialty_tags: [1, 2, 3],
    },
    location: {
      province: "Cebu",
      city: "Cebu City",
      barangay: "Lahug",
      street_address: "Gorordo Avenue",
      formatted_address: "Cebu City",
      unit: null,
      latitude: 10.31,
      longitude: 123.88,
      landmarks: [],
    },
    operating_hours: [
      {
        day: "monday",
        is_open: true,
        is_24_hours: false,
        open_time: "08:00",
        close_time: "17:00",
      },
    ],
    photos: [
      {
        id: 1,
        category: "storefront",
        photo_url: "https://example.com/store.jpg",
        file_name: "store.jpg",
      },
    ],
    documents: [
      {
        id: 1,
        document_type: "business_registration",
        document_url: "https://example.com/permit.pdf",
        file_name: "permit.pdf",
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function removeRoute(action: NavigationAction) {
  await act(async () => {
    if (mockPrevent) {
      mockRemoval({ data: { action } });
    } else {
      mockNavigation.dispatch(action);
    }
  });
}

describe("registration navigation and persistence integrity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    [
      mockSaveIdentity,
      mockSaveLocation,
      mockSaveHours,
      mockSavePhotos,
      mockSaveDocuments,
      mockSubmit,
      mockValidate,
    ].forEach((mock) => mock.mockReset());
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    mockApplication = application();
    mockValidate.mockResolvedValue(true);
    mockSaveIdentity.mockImplementation(async (payload) => ({
      success: true,
      data: {
        ...mockApplication!.identity,
        business_name: payload.business_name,
      },
    }));
    mockSaveLocation.mockResolvedValue({
      success: true,
      data: mockApplication.location,
    });
    mockSaveHours.mockResolvedValue({
      success: true,
      data: mockApplication.operating_hours,
    });
    mockSavePhotos.mockResolvedValue({
      success: true,
      data: mockApplication.photos,
    });
    mockSaveDocuments.mockResolvedValue({
      success: true,
      data: mockApplication.documents,
    });
    mockSubmit.mockResolvedValue({
      success: true,
      data: {
        review_sla_min_business_days: 3,
        review_sla_max_business_days: 5,
      },
    });
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, callback) => {
        mockHardwareBack = () => callback({} as never);
        return { remove: jest.fn() };
      });
  });
  afterEach(() => jest.restoreAllMocks());

  it("locks input, selectors and navigation across validation and a delayed save, and submits only once", async () => {
    mockApplication = application(0);
    const validation = deferred<boolean>();
    const save = deferred<unknown>();
    mockValidate.mockReturnValueOnce(validation.promise);
    mockSaveIdentity.mockReturnValueOnce(save.promise);
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Submitted Cafe",
    );
    const button = screen.getByRole("button", { name: "Save & Continue" });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(screen.getByPlaceholderText("Business name").props.editable).toBe(
      false,
    );
    expect(screen.getByPlaceholderText("Description").props.editable).toBe(
      false,
    );
    expect(
      screen.getByRole("button", { name: "Open location picker" }),
    ).toBeDisabled();
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Too late",
    );
    await act(async () => {
      validation.resolve(true);
    });
    await waitFor(() => expect(mockSaveIdentity).toHaveBeenCalledTimes(1));
    expect(mockSaveIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: "Submitted Cafe" }),
    );
    await removeRoute({ type: "POP", payload: { count: 1 } });
    await act(async () => {
      mockHardwareBack();
    });
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(screen.getByText("Step 1")).toBeTruthy();
    await act(async () => {
      save.resolve({ success: true, data: application().identity });
    });
    expect(screen.getByText("Step 2")).toBeTruthy();
    expect(screen.queryByText("You have unsaved changes")).toBeNull();
  });

  it("keeps failed values dirty and editable, then retries and reviews the successful snapshot", async () => {
    mockSaveIdentity.mockResolvedValueOnce({ success: false });
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit section 1" }),
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Retry Cafe",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Review" }),
    );
    await waitFor(() => expect(mockSaveIdentity).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue("Retry Cafe").props.editable).toBe(true);
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Review" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Review: Retry Cafe")).toBeTruthy(),
    );
    expect(screen.queryByText("You have unsaved changes")).toBeNull();
  });

  it("keeps a newer programmatic revision dirty instead of advancing after an older save", async () => {
    const save = deferred<unknown>();
    mockSaveIdentity.mockReturnValueOnce(save.promise);
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit section 1" }),
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Submitted Cafe",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Review" }),
    );
    await waitFor(() => expect(mockSaveIdentity).toHaveBeenCalledTimes(1));
    await act(async () => {
      mockForm.setValue("businessName", "New unsaved revision");
      save.resolve({ success: true, data: application().identity });
    });
    expect(screen.getByText("Step 1")).toBeTruthy();
    expect(screen.getByDisplayValue("New unsaved revision")).toBeTruthy();
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    expect(screen.queryByText("Review: New unsaved revision")).toBeNull();
  });

  it("uses the server's canonical identity in Review and its clean baseline", async () => {
    mockSaveIdentity.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockApplication!.identity,
        business_name: "Canonical Cafe",
        contact_number: "+639123456789",
      },
    });
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit section 1" }),
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Submitted Cafe",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Review" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Review: Canonical Cafe")).toBeTruthy(),
    );
    expect(mockForm.getValues("contactNumber")).toBe("+639123456789");
    expect(screen.queryByText("You have unsaved changes")).toBeNull();
  });

  it("does not enter Review while another section still has unsaved values", async () => {
    mockApplication = application(4);
    const screen = await render(<MerchantRegistrationScreen />);
    await act(async () => {
      mockForm.setValue("businessName", "Unsaved earlier section");
    });
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Continue" }),
    );
    expect(screen.getByText("Step 5")).toBeTruthy();
    expect(screen.queryByText("Review: Unsaved earlier section")).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4, 5])(
    "only marks section %s clean after successful persistence",
    async (step) => {
      const saves = [
        mockSaveIdentity,
        mockSaveLocation,
        mockSaveHours,
        mockSavePhotos,
        mockSaveDocuments,
      ];
      const save = deferred<unknown>();
      saves[step - 1].mockReturnValueOnce(save.promise);
      const screen = await render(<MerchantRegistrationScreen />);
      await fireEvent.press(
        screen.getByRole("button", { name: `Edit section ${step}` }),
      );
      await act(async () => {
        if (step === 1) mockForm.setValue("businessName", "Saved revision");
        if (step === 2) mockForm.setValue("unit", "Unit 2");
        if (step === 3)
          mockForm.setValue("operatingHours.monday.openTime", "09:00");
        if (step === 4)
          mockForm.setValue("businessPhotos.storefront", [
            { uri: "file:///new.jpg", mimeType: "image/jpeg" },
          ]);
        if (step === 5)
          mockForm.setValue("verificationDocuments.businessRegistration", {
            uri: "file:///new.pdf",
            fileName: "new.pdf",
            mimeType: "application/pdf",
          });
      });
      expect(screen.getByText("You have unsaved changes")).toBeTruthy();
      await fireEvent.press(
        screen.getByRole("button", { name: "Save & Review" }),
      );
      await waitFor(() => expect(saves[step - 1]).toHaveBeenCalledTimes(1));
      expect(screen.getByText(`Step ${step}`)).toBeTruthy();
      expect(screen.getByPlaceholderText("Business name").props.editable).toBe(
        false,
      );
      await act(async () => {
        mockHardwareBack();
      });
      expect(screen.getByText(`Step ${step}`)).toBeTruthy();
      const responses = [
        mockApplication!.identity,
        mockApplication!.location,
        mockApplication!.operating_hours,
        mockApplication!.photos,
        mockApplication!.documents,
      ];
      await act(async () => {
        save.resolve({ success: true, data: responses[step - 1] });
      });
      await waitFor(() => expect(screen.getByText("Step 6")).toBeTruthy());
      expect(screen.queryByText("You have unsaved changes")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Submit Application" }).props
          .accessibilityState.disabled,
      ).toBe(false);
      if (step === 4)
        expect(mockForm.getValues("businessPhotos.storefront")[0].id).toBe(1);
      if (step === 5)
        expect(
          mockForm.getValues("verificationDocuments.businessRegistration")?.id,
        ).toBe(1);
    },
  );

  it("renders saved review values and blocks final submission when hidden local values diverge", async () => {
    const screen = await render(<MerchantRegistrationScreen />);
    await act(async () => {
      mockForm.setValue("businessName", "Never saved");
    });
    expect(screen.getByText("Review: Saved Cafe")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Submit Application" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit Application" }),
    );
    await act(async () => {
      mockNext();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("confirms dirty route removal, preserves values on Stay, and dispatches the exact original action once", async () => {
    mockApplication = application(0);
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Unsaved Cafe",
    );
    const action = {
      type: "REPLACE",
      target: "parent",
      payload: { name: "another-route" },
    };
    await removeRoute(action);
    expect(screen.getByText("Discard changes?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Stay" }));
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Unsaved Cafe")).toBeTruthy();
    await removeRoute(action);
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("allows clean route removal without a confirmation", async () => {
    mockApplication = application(1);
    const screen = await render(<MerchantRegistrationScreen />);
    const action = { type: "POP", payload: { count: 2 } };
    await removeRoute(action);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
    expect(screen.queryByText("Discard changes?")).toBeNull();
  });

  it("allows auth/session redirects and ignores an old session's late save", async () => {
    mockApplication = application(0);
    const save = deferred<unknown>();
    mockSaveIdentity.mockReturnValueOnce(save.promise);
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Old account",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Continue" }),
    );
    await waitFor(() => expect(mockSaveIdentity).toHaveBeenCalledTimes(1));
    await act(async () => {
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
    });
    const action = { type: "RESET", payload: { routes: [{ name: "login" }] } };
    await removeRoute(action);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
    await act(async () => {
      save.resolve({ success: true, data: application().identity });
    });
    expect(screen.queryByText("Discard changes?")).toBeNull();
    expect(useMerchantRegistrationStore.getState().selectedLocation).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("preserves dirty work across child picker pushes and round trips", async () => {
    mockApplication = application(1);
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Local draft",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Open location picker" }),
    );
    expect(router.push).toHaveBeenCalledWith(
      "/(explorer)/merchant-registration/location-picker",
    );
    expect(screen.queryByText("Discard changes?")).toBeNull();
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(screen.getByDisplayValue("Local draft")).toBeTruthy();
  });

  it.each(["footer", "hardware"])(
    "uses %s Back to move to the previous middle step",
    async (path) => {
      mockApplication = application(2);
      const screen = await render(<MerchantRegistrationScreen />);
      if (path === "footer") {
        await fireEvent.press(screen.getByRole("button", { name: "Back" }));
      } else {
        await act(async () => {
          expect(mockHardwareBack()).toBe(true);
        });
      }
      expect(screen.getByText("Step 2")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
    },
  );

  it.each(["header", "hardware"])(
    "uses protected exit from the first step via %s",
    async (path) => {
      mockApplication = application(0);
      const screen = await render(<MerchantRegistrationScreen />);
      await fireEvent.changeText(
        screen.getByPlaceholderText("Business name"),
        "Unsaved Cafe",
      );
      if (path === "header") {
        const header = mockNavigation.setOptions.mock.lastCall![0].headerLeft();
        expect(header.props.accessibilityLabel).toBe("Exit registration");
        await act(async () => {
          header.props.onPress();
        });
      } else {
        await act(async () => {
          mockHardwareBack();
        });
      }
      expect(screen.getByText("Discard changes?")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
      expect(router.back).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["footer", "hardware"])(
    "returns to persisted Review through %s after confirming discarded section edits",
    async (path) => {
      const screen = await render(<MerchantRegistrationScreen />);
      await fireEvent.press(
        screen.getByRole("button", { name: "Edit section 1" }),
      );
      await fireEvent.changeText(
        screen.getByPlaceholderText("Business name"),
        "Discard me",
      );
      if (path === "footer") {
        await fireEvent.press(
          screen.getByRole("button", { name: "Back to Review" }),
        );
      } else {
        await act(async () => {
          mockHardwareBack();
        });
      }
      await fireEvent.press(screen.getByRole("button", { name: "Stay" }));
      expect(screen.getByDisplayValue("Discard me")).toBeTruthy();
      await fireEvent.press(
        screen.getByRole("button", { name: "Back to Review" }),
      );
      await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
      expect(screen.getByText("Review: Saved Cafe")).toBeTruthy();
      expect(router.back).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Submit Application" }).props
          .accessibilityState.disabled,
      ).toBe(false);
    },
  );

  it("preserves correction gates for rejected applications and permits an authoritative correction", async () => {
    mockApplication = {
      ...application(),
      status: "rejected",
      latest_review: {
        decision: "rejected",
        reviewed_at: "2026-10-26",
        reviewer: { name: "Admin", email: "admin@example.com" },
        feedback: [
          { section: "identity", message: "Correct name", is_changed: false },
        ],
      },
    };
    const screen = await render(<MerchantRegistrationScreen />);
    expect(
      screen.getByRole("button", { name: "Resubmit Application" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit section 1" }),
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Business name"),
      "Corrected Cafe",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Save & Review" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Review: Corrected Cafe")).toBeTruthy(),
    );
    expect(
      screen.getByRole("button", { name: "Resubmit Application" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    mockApplication = {
      ...mockApplication,
      latest_review: {
        ...mockApplication.latest_review!,
        feedback: [
          { section: "identity", message: "Correct name", is_changed: true },
        ],
      },
    };
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(
      screen.getByRole("button", { name: "Resubmit Application" }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });

  it("submits a clean authoritative review and allows the success replacement", async () => {
    const screen = await render(<MerchantRegistrationScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit Application" }),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: "/(explorer)/merchant-registration/submission-success",
        params: { minBusinessDays: "3", maxBusinessDays: "5" },
      }),
    );
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard changes?")).toBeNull();
    const action = { type: "REPLACE", payload: { name: "submission-success" } };
    await removeRoute(action);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
  });
});
