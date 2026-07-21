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
      <div className="my-auto py-4 flex flex-col items-center justify-center w-full max-w-lg min-h-0 flex-1">
        <img
          src={adminLoginIllustration}
          alt="Admin login illustration"
          className="h-auto max-h-[65vh] w-full max-w-[380px] lg:max-w-[420px] xl:max-w-[880px] object-contain mb-6"
        />
        <p className="text-sm text-gray-500 leading-relaxed max-w-md shrink-0">
          Simplify tourism management and operations seamlessly.
        </p>
      </div>
    </>
  );
}

export default LoginIllustration;
