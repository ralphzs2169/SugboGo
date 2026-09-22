import { fireEvent, render } from "@testing-library/react-native";

import ReviewBusinessIdentity from "../ReviewBusinessIdentity";

const mockRefetchSpecialtyTags = jest.fn();

let mockSpecialtyTagState = {
  specialtyTags: [] as { id: number; name: string }[],
  isLoading: false,
  hasData: true,
  error: null as Error | null,
  refetch: mockRefetchSpecialtyTags,
};

jest.mock("@/features/merchant/hooks/registration/useSpecialtyTags", () => ({
  __esModule: true,
  default: () => mockSpecialtyTagState,
}));

const form = {
  businessName: "Cebu Cafe",
  businessCluster: "1",
  businessCategory: "2",
  representativeName: "Cebu Owner",
  representativeRole: "owner",
  businessDescription: "Local coffee shop",
  contactNumber: "09123456789",
  businessEmail: "owner@example.com",
  website: "https://example.com",
  specialtyTags: [3],
} as unknown as React.ComponentProps<typeof ReviewBusinessIdentity>["form"];

const clusters = [{ id: 1, name: "Food", icon: "coffee" }] as React.ComponentProps<
  typeof ReviewBusinessIdentity
>["clusters"];

const categories = [{ id: 2, cluster_id: 1, name: "Cafe" }];

function renderIdentity() {
  return render(
    <ReviewBusinessIdentity
      form={form}
      clusters={clusters}
      categories={categories}
    />,
  );
}

describe("ReviewBusinessIdentity specialty-tag query states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpecialtyTagState = {
      specialtyTags: [],
      isLoading: false,
      hasData: true,
      error: null,
      refetch: mockRefetchSpecialtyTags,
    };
  });

  it("does not render selected tags as missing during initial loading", async () => {
    mockSpecialtyTagState.isLoading = true;
    mockSpecialtyTagState.hasData = false;

    const screen = await renderIdentity();

    expect(screen.getByText("Loading specialty tags...")).toBeTruthy();
    expect(screen.queryByText("Not provided")).toBeNull();
  });

  it("shows a retryable lookup error instead of missing tags", async () => {
    mockSpecialtyTagState.hasData = false;
    mockSpecialtyTagState.error = new Error("Unavailable");

    const screen = await renderIdentity();

    expect(screen.getByText("Unable to load specialty tags.")).toBeTruthy();
    expect(screen.queryByText("Not provided")).toBeNull();

    fireEvent.press(screen.getByText("Retry"));
    expect(mockRefetchSpecialtyTags).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing empty state after a successful empty lookup", async () => {
    const screen = await renderIdentity();

    expect(screen.getByText("Not provided")).toBeTruthy();
  });
});
