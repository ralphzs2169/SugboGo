import PasswordInput from "./PasswordInput";
import SugboGoText from "../../../shared/components/SugboGoText";
import TextInput from "./TextInput";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";

/**
 * LoginForm component renders a login form for the admin dashboard.
 * It includes fields for email/username and password, a "Remember Me" checkbox,
 * a "Forgot Password?" link, and a submit button.
 */
function LoginForm() {
  const { handleLogin, loading } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function onSubmit(event) {
    event.preventDefault();

    const result = await handleLogin(email, password);

    if (result.success) {
      navigate("/admin-panel/dashboard");
      return;
    }

    // Display backend message
    setError(result.message);
  }
  return (
    <article className="rounded-2xl bg-white p-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Welcome to <SugboGoText includeAdmin />
        </h1>
        <p className="mt-2 text-sm text-gray-500">Admin Dashboard</p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-4">
          <TextInput
            id="identifier"
            name="identifier"
            label="Email/Username"
            autoComplete="username"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label
            htmlFor="remember-me"
            className="flex select-none items-center gap-2 text-gray-600"
          >
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>Remember Me</span>
          </label>

          <a
            href="#forgot-password"
            className="font-medium text-primary transition hover:opacity-80 focus:outline-none focus-visible:text-primary"
          >
            Forgot Password?
          </a>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:brightness-95 active:translate-y-px focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </article>
  );
}

export default LoginForm;
