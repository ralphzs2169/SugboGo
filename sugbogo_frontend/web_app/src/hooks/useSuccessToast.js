import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function useSuccessToast() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const message = location.state?.successMessage;

    if (!message) return;

    toast.success(message);

    navigate(location.pathname, {
      replace: true,
      state: {},
    });
  }, [location, navigate]);
}
