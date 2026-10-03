import { CheckCircle2, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

import PrimaryButton from "../common/PrimaryButton";

export default function AdminInvitationSetupSuccess() {
  const navigate = useNavigate();

  return (
    <article className="w-full text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2
          className="h-10 w-10 text-success"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Your Admin Account Is Ready
      </h1>

      <p className="mt-4 text-sm leading-6 text-gray-500 sm:text-base">
        You can now sign in to the SugboGo Admin portal.
      </p>

      <PrimaryButton
        className="mt-8"
        icon={<LogIn className="h-5 w-5" aria-hidden="true" />}
        onClick={() => navigate("/login")}
      >
        Go to Admin Login
      </PrimaryButton>
    </article>
  );
}
