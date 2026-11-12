const supportEmail = "support.sugbogo@gmail.com";

export default function SupportEmailLink() {
  return (
    <a href={`mailto:${supportEmail}`} className="wrap-anywhere">
      {supportEmail}
    </a>
  );
}
