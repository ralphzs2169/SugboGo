import GoogleLogo from "@/assets/icons/google-logo.svg";

type Props = {
  size?: number;
};

export default function GoogleIcon({ size = 26 }: Props) {
  return <GoogleLogo width={size} height={size} />;
}
