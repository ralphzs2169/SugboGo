import { useNavigate } from "react-router-dom";

/**
 * Custom hook that provides a function to navigate back to the previous page.
 * If there is no previous page in the history stack, it navigates to a fallback path.
 */
export default function useNavigateBack(fallbackPath) {
  const navigate = useNavigate();

  return function goBack() {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };
}
