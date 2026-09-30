import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "S";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const SIZE_CLASS = {
  sm: "size-8 text-[0.65rem]",
  md: "size-10 text-xs",
  lg: "size-16 text-lg",
} as const;

export function SocialAvatar({
  name,
  src,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  size?: keyof typeof SIZE_CLASS;
  ring?: boolean;
  className?: string;
}) {
  const initials = initialsFromName(name || "Soldado");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-foreground",
        SIZE_CLASS[size],
        ring && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      aria-hidden={src ? undefined : true}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        initials
      )}
    </span>
  );
}
