import { useState } from "react";
import type { ResolvedMedia } from "@/lib/soldiers-media";
import { cn } from "@/lib/utils";

/** Poster / video / gif from a resolved Soldiers media package. Falls back to children. */
export function SoldiersMediaFrame({
  media,
  alt,
  className,
  imgClassName,
  autoPlay = true,
}: {
  media: ResolvedMedia;
  alt: string;
  className?: string;
  imgClassName?: string;
  autoPlay?: boolean;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoSrc = !videoFailed && (media.webmUrl || media.mp4Url);
  // Poster/thumb first; GIF is last-resort (never the primary format).
  const still = media.posterUrl || media.thumbnailUrl || media.gifUrl;

  if (videoSrc) {
    return (
      <div className={cn("relative overflow-hidden bg-[#080808]", className)}>
        <video
          className={cn("h-full w-full object-cover", imgClassName)}
          poster={media.posterUrl}
          autoPlay={autoPlay}
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
        >
          {media.webmUrl ? <source src={media.webmUrl} type="video/webm" /> : null}
          {media.mp4Url ? <source src={media.mp4Url} type="video/mp4" /> : null}
        </video>
      </div>
    );
  }

  if (still) {
    return (
      <div className={cn("relative overflow-hidden bg-[#080808]", className)}>
        <img
          src={still}
          alt={alt}
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      </div>
    );
  }

  return null;
}

export function SoldiersMediaThumb({
  media,
  alt,
  className,
}: {
  media: ResolvedMedia;
  alt: string;
  className?: string;
}) {
  const src = media.thumbnailUrl || media.posterUrl || media.gifUrl;
  if (!src) return null;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-[#080808]", className ?? "size-12")}>
      <img
        src={src}
        alt={alt}
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
