import { render } from "@testing-library/react-native";

import ErrorState from "@/shared/components/ErrorState";
import RegistrationLayout from "../../components/registration/RegistrationLayout";
import MerchantRegistrationScreen from "../MerchantRegistrationScreen";

const mockRefetchApplication = jest.fn();

let mockApplicationState = {
  application: {
    status: "rejected",
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
  default: () => mockApplicationState,
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
jest.mock("../../utils/merchant-application/mappers/mapApplicationToForm.utils", () => ({
  mapApplicationToForm: jest.fn(() => ({})),
}));
jest.mock("../../utils/merchant-application/mappers/mapApplicationToStore.utils", () => ({
  mapApplicationToStore: jest.fn(() => ({
    selectedLocation: null,
    selectedAddress: null,
    selectedLandmarks: [],
  })),
}));
jest.mock("../../utils/merchant-application/normalizers/normalizeIdentity.utils", () => ({
  normalizeIdentity: jest.fn(() => ({})),
}));
jest.mock("../../utils/merchant-application/normalizers/normalizeLocation.utils", () => ({
  normalizeLocation: jest.fn(() => ({})),
}));
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
jest.mock("../../components/registration/RegistrationStepper", () => () => null);
jest.mock("../../components/registration/RegistrationStepContent", () => () => null);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);

describe("MerchantRegistrationScreen rejected refresh recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplicationState = {
      application: {
        status: "rejected",
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

  it("keeps stale feedback gated and provides a retry until refresh succeeds", async () => {
    const screen = await render(<MerchantRegistrationScreen />);

    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "section",
        title: "Unable to refresh registration",
      }),
      undefined,
    );
    expect((RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props)
      .toEqual(expect.objectContaining({ canResubmit: false }));

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

    expect((RegistrationLayout as jest.Mock).mock.lastCall[0].footer.props)
      .toEqual(expect.objectContaining({ canResubmit: true }));
    screen.unmount();
  });
});
