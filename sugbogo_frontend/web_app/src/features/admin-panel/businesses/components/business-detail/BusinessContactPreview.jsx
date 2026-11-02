import { ContactRound, Globe, Mail, Phone } from "lucide-react";

/**
 * Displays a business's contact channels — phone, email, and website.
 *
 * Each row is independently optional and renders as a clickable link that
 * triggers the appropriate action (call, email, or open site in a new tab).
 */
export default function BusinessContactPreview({
  contactNumber,
  email,
  website,
}) {
  const hasAnyContact = contactNumber || email || website;

  if (!hasAnyContact) {
    return null;
  }

  return (
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <ContactRound size={14} aria-hidden="true" /> Contact
      </h2>

      <div className="mt-2 space-y-2.5">
        {contactNumber && (
          <a
            href={`tel:${contactNumber}`}
            className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {contactNumber}
            </span>
          </a>
        )}

        {email && (
          <a
            href={`mailto:${email}`}
            className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{email}</span>
          </a>
        )}

        {website && (
          <a
            href={website.startsWith("http") ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{website}</span>
          </a>
        )}
      </div>
    </div>
  );
}
