import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

/** Preserve image dimensions and expose a neutral fallback for missing or failed media. */
export default function BusinessImage(props) {
  return <ImageState key={props.src || "missing"} {...props} />;
}

/** Reset load/error state when the authoritative image URL changes. */
function ImageState({
  src,
  alt,
  className = "",
  loading = "lazy",
  fallback = "Photo unavailable",
  fit = "cover",
  transparent = false,
}) {
  const [state, setState] = useState(src ? "loading" : "missing");
  const unavailable = state === "error" || state === "missing";
  return (
    <div
      className={`relative overflow-hidden ${transparent ? "bg-transparent" : "bg-surface-muted"} ${className}`}
    >
      {/* Reserved media space */}
      {state === "loading" && (
        <div
          className="absolute inset-0 motion-safe:animate-pulse bg-skeleton"
          aria-hidden="true"
        />
      )}
      {!unavailable && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${state === "loading" ? "opacity-0" : ""}`}
        />
      )}
      {/* Neutral unavailable state */}
      {unavailable && (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-text-secondary"
          role={alt ? "img" : undefined}
          aria-label={alt ? `${alt}: ${fallback}` : undefined}
        >
          <ImageIcon aria-hidden="true" size={24} strokeWidth={1.5} />
          {fallback && <span className="text-xs text-center">{fallback}</span>}
        </div>
      )}
    </div>
  );
}
