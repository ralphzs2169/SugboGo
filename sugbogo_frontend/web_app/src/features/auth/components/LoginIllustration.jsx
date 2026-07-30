import SugboGoLogo from "../../../assets/logos/sugbogo-logo.svg";
import SugboGoText from "../../../shared/components/SugboGoText";
import adminLoginIllustration from "../assets/admin-login-illustration.svg";

/**
 * LoginIllustration component that renders the illustration section of the admin login page.
 * It includes the SugboGo logo, a title, and an illustration image.
 */
function LoginIllustration() {
  return (
    <>
      <div className="w-full flex items-center gap-3 shrink-0">
        <img src={SugboGoLogo} alt="SugboGo Logo" className="h-8 w-auto" />
        <div className="font-bold text-gray-900 text-lg">
          <SugboGoText includeAdmin />
        </div>
      </div>

      {/* Center Hero Illustration & Caption */}
      <div className="my-auto flex min-h-0 flex-1 flex-col items-center justify-center py-4 w-full max-w-2xl">
        <img
          src={adminLoginIllustration}
          alt="Admin login illustration"
          className="mb-6 h-auto max-h-[70vh] w-full max-w-[460px] object-contain lg:max-w-[540px] xl:max-w-[620px]"
        />

        <p className="max-w-md shrink-0 text-sm leading-relaxed text-gray-500">
          Simplify tourism management and operations seamlessly.
        </p>
      </div>
    </>
  );
}

export default LoginIllustration;
