import { useState } from "react";

/** Lazy image with decoding async and optional dimensions for CLS. */
export function AppImage({
  src,
  alt,
  className,
  width,
  height,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  /** When true, skip lazy loading (above-the-fold). */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      {...(width != null ? { width } : {})}
      {...(height != null ? { height } : {})}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
