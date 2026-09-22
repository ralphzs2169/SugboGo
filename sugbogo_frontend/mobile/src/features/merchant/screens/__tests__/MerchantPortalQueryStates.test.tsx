import { render } from "@testing-library/react-native";

import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import MerchantPortalScreen from "../MerchantPortalScreen";

const mockRefetch = jest.fn();

let mockPortalState = {
  registrationStatus: "DRAFT",
  config: {
    hero: false,
    sections: {
      progress: true,
      status: false,
      feedback: false,
      dashboard: false,
      benefits: false,
      requirements: false,
    },
    primaryAction: { buttonTitle: "Resume Application" },
  },
  application: { id: 1, highest_completed_step: 2 } as {
    id: number;
    highest_completed_step: number;
  } | null,
  isLoading: false,
  error: false,
  refetch: mockRefetch,
};

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => void) => callback(),
}));
jest.mock("../../hooks/useMerchantPortalState", () => ({
  useMerchantPortalState: () => mockPortalState,
}));
jest.mock("../../hooks/useAcknowledgeMerchantMode", () => ({
  __esModule: true,
  default: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveMode: jest.fn() }),
}));
jest.mock("@/shared/components/Button", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/shared/components/LoadingScreen", () => () => null);
jest.mock("../../components/portal/ResumeApplicationSection", () => () => null);
jest.mock("../../components/portal/SubmittedApplicationSection", () => () => null);
jest.mock("../../components/portal/RejectedApplicationSection", () => () => null);
jest.mock("../../components/portal/ApprovedApplicationSection", () => () => null);
jest.mock("../../components/portal/MerchantBenefits", () => () => null);
jest.mock("../../components/portal/MerchantRequirements", () => () => null);
jest.mock("../../components/portal/MerchantHero", () => () => null);

describe("MerchantPortalScreen current-application errors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPortalState = {
      ...mockPortalState,
      application: { id: 1, highest_completed_step: 2 },
      isLoading: false,
      error: false,
      refetch: mockRefetch,
    };
  });

  it("keeps the cached portal content and offers a non-blocking retry", async () => {
    mockPortalState.error = true;

    await render(<MerchantPortalScreen />);

    expect(Button).toHaveBeenCalled();
    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "section",
        title: "Unable to refresh merchant portal",
      }),
      undefined,
    );

    const retry = (ErrorState as jest.Mock).mock.lastCall[0].onPrimaryAction;
    retry();
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it("uses the blocking error when no application data is available", async () => {
    mockPortalState.application = null;
    mockPortalState.error = true;

    await render(<MerchantPortalScreen />);

    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to load merchant portal" }),
      undefined,
    );
    expect(Button).not.toHaveBeenCalled();
  });
});
