import { act, render } from "@testing-library/react-native";

import ErrorState from "@/shared/components/ErrorState";
import RegistrationLayout from "../../components/registration/RegistrationLayout";
import MerchantRegistrationScreen from "../MerchantRegistrationScreen";
import type { DuplicateDisposition } from "../../types/registration/registrationApi.types";
import { useMerchantRegistrationStore } from "../../stores/merchantRegistrationStore";
import { mapApplicationToStore } from "../../utils/merchant-application/mappers/mapApplicationToStore.utils";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";

const mockRefetchApplication = jest.fn();
let mockHasNoApplication = false;

const savedLocation = {
  latitude: 10.31,
  longitude: 123.88,
  formattedAddress: "Cebu City",
  province: "Cebu",
  city: "Cebu City",
  barangay: "Lahug",
  streetAddress: "Gorordo Avenue",
  isWithinServiceArea: true,
};

jest.mock(
  "../../utils/merchant-application/comparisons/getUnsavedSections.utils",
  () => ({
    getUnsavedSections: () => [],
  }),
);

let mockApplicationState = {
  application: {
    status: "rejected",
    duplicate_disposition: null as DuplicateDisposition | null,
    highest_completed_step: 5,
    operating_hours: [],
    latest_review: {
      feedback: [{ section: "identity", is_changed: false }],
    },
  },
  isLoading: false,
  error: true,
  refetch: mockRefetchApplication,
};

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("../../constants/registration/registrationSteps", () => ({
  REGISTRATION_STEPS: [
    { title: "Identity" },
    { title: "Location" },
    { title: "Hours" },
    { title: "Photos" },
    { title: "Documents" },
    { title: "Review" },
  ],
}));
jest.mock("../../hooks/registration/useCurrentApplication", () => ({
  __esModule: true,
  default: () => ({
    ...mockApplicationState,
    application: mockHasNoApplication ? null : mockApplicationState.application,
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
jest.mock("../../hooks/registration/useRegistrationNavigation", () => ({
  __esModule: true,
  default: () => ({
    currentStep: 6,
    editingStep: null,
    highestCompletedStep: 5,
    scrollRef: { current: null },
    goToReview: jest.fn(),
    handleBack: jest.fn(),
    handleEditSection: jest.fn(),
    completeCurrentStep: jest.fn(),
    setCurrentStep: jest.fn(),
    setHighestCompletedStep: jest.fn(),
  }),
}));
jest.mock("../../hooks/registration/useRegistrationErrorScroll", () => ({
  __esModule: true,
  default: () => ({
    registerErrorScrollTarget: jest.fn(() => ({})),
    scrollToFirstError: jest.fn(),
  }),
}));
jest.mock("../../hooks/registration/useRegistrationValidation", () => ({
  __esModule: true,
  default: () => ({ validateCurrentStep: jest.fn() }),
}));

jest.mock("../../hooks/registration/useSaveIdentity", () => ({
  __esModule: true,
  default: () => ({ isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveLocation", () => ({
  __esModule: true,
  default: () => ({ isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveOperatingHours", () => ({
  __esModule: true,
  default: () => ({ isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveApplicationPhotos", () => ({
  __esModule: true,
  default: () => ({ isSaving: false }),
}));
jest.mock("../../hooks/registration/useSaveApplicationDocuments", () => ({
  __esModule: true,
  default: () => ({ isSaving: false }),
}));
jest.mock("../../hooks/registration/useSubmitApplication", () => ({
  __esModule: true,
  default: () => ({ isSubmitting: false }),
}));
jest.mock(
  "../../utils/merchant-application/mappers/mapApplicationToForm.utils",
  () => ({
    mapApplicationToForm: jest.fn(() => ({})),
  }),
);
jest.mock(
  "../../utils/merchant-application/mappers/mapApplicationToStore.utils",
  () => ({
    mapApplicationToStore: jest.fn(() => ({
      selectedLocation: null,
      selectedAddress: null,
      selectedLandmarks: [],
    })),
  }),
);
jest.mock(
  "../../utils/merchant-application/normalizers/normalizeIdentity.utils",
  () => ({
    normalizeIdentity: jest.fn(() => ({})),
  }),
);
jest.mock(
  "../../utils/merchant-application/normalizers/normalizeLocation.utils",
  () => ({
    normalizeLocation: jest.fn(() => ({})),
  }),
);
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/shared/components/LoadingScreen", () => () => null);
jest.mock("../../components/registration/RegistrationLayout", () => ({
  __esModule: true,
  default: jest.fn(({ children }) => children),
}));
jest.mock("../../components/registration/RegistartionFooter", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock(
  "../../components/registration/RegistrationStepper",
  () => () => null,
);
jest.mock(
  "../../components/registration/RegistrationStepContent",
  () => () => null,
);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);

describe("MerchantRegistrationScreen rejected refresh recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasNoApplication = false;
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 1 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    mockApplicationState = {
      application: {
        status: "rejected",
        duplicate_disposition: null as DuplicateDisposition | null,
        highest_completed_step: 5,
        operating_hours: [],
        latest_review: {
          feedback: [{ section: "identity", is_changed: false }],
        },
      },
      isLoading: false,
      error: true,
      refetch: mockRefetchApplication,
    };
  });

  it("clears absent server location values once without overwriting picker round trips or refreshes", async () => {
    mockApplicationState.error = false;
    useMerchantRegistrationStore.setState({
      selectedLocation: savedLocation,
      selectedAddress: { ...savedLocation, unit: "Old" },
      addressLoadFailed: true,
    });
    const screen = await render(<MerchantRegistrationScreen />);
    expect(useMerchantRegistrationStore.getState()).toMatchObject({
      selectedLocation: null,
      selectedAddress: null,
      selectedLandmarks: [],
      addressLoadFailed: false,
    });

    const pickerLocation = { ...savedLocation, latitude: 11, longitude: 124 };
    await act(async () => {
      useMerchantRegistrationStore
        .getState()
        .setSelectedLocation(pickerLocation);
    });
    mockApplicationState = {
      ...mockApplicationState,
      application: { ...mockApplicationState.application },
    };
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(useMerchantRegistrationStore.getState().selectedLocation).toEqual(
      pickerLocation,
    );

    await act(async () => {
      beginAuthSession();
      useAuthStore.getState().setUser({ id: 2 } as User);
    });
    expect(mapApplicationToStore).toHaveBeenCalledTimes(2);
    expect(useMerchantRegistrationStore.getState().selectedLocation).toBeNull();
    await screen.unmount();
  });

  it("does not restore cached application data after session expiration", async () => {
    mockApplicationState.error = false;
    const screen = await render(<MerchantRegistrationScreen />);
    expect(mapApplicationToStore).toHaveBeenCalledTimes(1);

    await act(async () => {
      invalidateAuthSession();
    });

    expect(mapApplicationToStore).toHaveBeenCalledTimes(1);
    expect(useMerchantRegistrationStore.getState().selectedLocation).toBeNull();
    await screen.unmount();
  });

  it("restores a complete saved location, address, and landmark snapshot", async () => {
    mockApplicationState.error = false;
    const snapshot = {
      selectedLocation: savedLocation,
      selectedAddress: { ...savedLocation, unit: "Saved unit" },
      selectedLandmarks: [],
    };
    (mapApplicationToStore as jest.Mock).mockReturnValueOnce(snapshot);
    const screen = await render(<MerchantRegistrationScreen />);
    expect(useMerchantRegistrationStore.getState()).toMatchObject(snapshot);
    await screen.unmount();
  });

  it("initializes a new application once and preserves later same-session picker work", async () => {
    mockHasNoApplication = true;
    mockApplicationState.error = false;
    useMerchantRegistrationStore.getState().setSelectedLocation(savedLocation);
    const screen = await render(<MerchantRegistrationScreen />);
    expect(useMerchantRegistrationStore.getState().selectedLocation).toBeNull();
    await act(async () => {
      useMerchantRegistrationStore
        .getState()
        .setSelectedLocation(savedLocation);
    });
    mockHasNoApplication = false;
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(mapApplicationToStore).not.toHaveBeenCalled();
    expect(useMerchantRegistrationStore.getState().selectedLocation).toEqual(
      savedLocation,
    );
    await screen.unmount();
  });

  it("keeps stale feedback gated and provides a retry until refresh succeeds", async () => {
    const screen = await render(<MerchantRegistrationScreen />);

    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "section",
        title: "Unable to refresh registration",
      }),
      undefined,
    );
    expect(
      (RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props,
    ).toEqual(expect.objectContaining({ canResubmit: false }));

    const retry = (ErrorState as jest.Mock).mock.lastCall[0].onPrimaryAction;
    retry();
    expect(mockRefetchApplication).toHaveBeenCalledTimes(1);

    mockApplicationState = {
      ...mockApplicationState,
      error: false,
      application: {
        ...mockApplicationState.application,
        latest_review: {
          feedback: [{ section: "identity", is_changed: true }],
        },
      },
    };
    await screen.rerender(<MerchantRegistrationScreen />);

    expect(
      (RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props,
    ).toEqual(expect.objectContaining({ canResubmit: true }));
    screen.unmount();
  });
  it("allows duplicate-only unchanged resubmission and still gates combined corrections", async () => {
    mockApplicationState = {
      ...mockApplicationState,
      error: false,
      application: {
        ...mockApplicationState.application,
        duplicate_disposition: {
          review_id: 9,
          explanation: "Same business",
          reconsidered: false,
          reconsideration_explanation: null,
        },
        latest_review: { feedback: [] },
      },
    };
    const screen = await render(<MerchantRegistrationScreen />);
    expect(
      (RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props
        .canResubmit,
    ).toBe(true);
    mockApplicationState.application.latest_review.feedback = [
      { section: "identity", is_changed: false },
    ];
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(
      (RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props
        .canResubmit,
    ).toBe(false);
    mockApplicationState.application.latest_review.feedback = [
      { section: "identity", is_changed: true },
    ];
    await screen.rerender(<MerchantRegistrationScreen />);
    expect(
      (RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props
        .canResubmit,
    ).toBe(true);
    await screen.unmount();
  });
});
