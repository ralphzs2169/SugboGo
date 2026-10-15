import { act, render } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useDeleteReview } from "@/features/explore/hooks/useBusinessReviews";
import type { MyReview } from "../../../types/myReview.types";
import MyReviewDeleteConfirmation from "../MyReviewDeleteConfirmation";

const mockDelete = jest.fn();
const onClose = jest.fn();
let mockConfirmation: {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
};

jest.mock("@/features/explore/hooks/useBusinessReviews", () => ({
  useDeleteReview: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: typeof mockConfirmation) => {
    mockConfirmation = props;
    return null;
  },
}));

const review = { id: 17, business: { id: 20 } } as MyReview;

describe("MyReviewDeleteConfirmation submission guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    (useDeleteReview as jest.Mock).mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    });
  });

  it("guards rapid confirm, cancel, and repeat confirmation until the operation completes", async () => {
    let finish!: () => void;
    mockDelete.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const screen = await render(
      <MyReviewDeleteConfirmation
        review={review}
        userId={10}
        onClose={onClose}
      />,
    );
    await act(async () => {
      mockConfirmation.onConfirm();
      mockConfirmation.onConfirm();
      mockConfirmation.onCancel();
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith({ reviewId: 17 });
    expect(useDeleteReview).toHaveBeenCalledWith(20);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      finish();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
    await screen.unmount();
  });

  it("exposes the existing pending state to the shared confirmation", async () => {
    (useDeleteReview as jest.Mock).mockReturnValue({
      mutateAsync: mockDelete,
      isPending: true,
    });
    await render(
      <MyReviewDeleteConfirmation
        review={review}
        userId={10}
        onClose={onClose}
      />,
    );
    expect(mockConfirmation.isLoading).toBe(true);
    await act(async () => {
      mockConfirmation.onConfirm();
      mockConfirmation.onCancel();
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not submit for a changed account", async () => {
    await render(
      <MyReviewDeleteConfirmation
        review={review}
        userId={10}
        onClose={onClose}
      />,
    );
    await act(async () => {
      useAuthStore.setState({ user: { id: 99 } as never });
      mockConfirmation.onConfirm();
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
