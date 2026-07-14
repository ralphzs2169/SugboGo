import LoginForm from "./LoginForm";
import LoginIllustration from "./LoginIllustration";
import loginBackground from "../assets/admin-login-bg.svg";

/**
 * LoginCard component that renders the login page for the admin panel.
 * It includes a background image, a login illustration, and the login form.
 */
function LoginCard() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 lg:px-8">
      {/* Background Image */}
      <img
        src={loginBackground}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-gray-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr]">
          <LoginIllustration />

          <section className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="w-full max-w-md">
              <LoginForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginCard;
