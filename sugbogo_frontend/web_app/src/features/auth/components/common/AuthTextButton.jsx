/**
 * AuthTextButton renders a text-only button for secondary
 * authentication actions (e.g. Forgot Password, Back to Sign In).
 */
export default function AuthTextButton({ children, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center cursor-pointer justify-center gap-2 text-sm font-semibold text-primary transition-all duration-200 hover:text-primary/80 hover:underline"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
