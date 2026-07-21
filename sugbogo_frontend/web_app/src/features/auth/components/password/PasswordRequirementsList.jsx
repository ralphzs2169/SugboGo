import PasswordRequirementItem from "./PasswordRequirementItem";
import { getPasswordRequirements } from "../../utils/passwordRules";

/**
 * Live-updating checklist of password requirements, shown once the user
 * starts typing a password.
 */
export default function PasswordRequirementsList({
  password,
  confirmPassword,
}) {
  if (!password) return null;

  const requirements = getPasswordRequirements(password, confirmPassword);

  return (
    <ul className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3.5">
      {requirements.map(({ id, label, met }) => (
        <PasswordRequirementItem key={id} label={label} met={met} />
      ))}
    </ul>
  );
}
