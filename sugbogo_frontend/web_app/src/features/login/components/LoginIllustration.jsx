import adminLoginIllustration from "../assets/admin-login.svg";
import SugboGoLogo from "../../../assets/logos/sugbogo-logo.svg";
import SugboGoText from "../../../shared/components/SugboGoText";

/**
 * LoginIllustration component that renders the illustration section of the admin login page.
 * It includes the SugboGo logo, a title, and an illustration image.
 */
function LoginIllustration() {
  return (
    <section className="relative flex items-center justify-center bg-gray-50 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="absolute left-6 top-6 flex items-center gap-3 sm:left-8 sm:top-8 lg:left-10 lg:top-10">
        <img src={SugboGoLogo} alt="SugboGo Logo" className="h-12" />

        <p className="text-base font-bold text-gray-900">
          <SugboGoText includeAdmin />
        </p>
      </div>

      <img
        src={adminLoginIllustration}
        alt="Admin login illustration"
        className="h-auto w-full max-w-[430px] object-contain"
      />
    </section>
  );
}

export default LoginIllustration;
