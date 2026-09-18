import {
  LoaderCircleIcon,
  LoaderIcon,
  LoaderPinwheelIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerVariantProps = Omit<SpinnerProps, "variant">;

const Throbber = ({ className, ...props }: SpinnerVariantProps) => (
  <LoaderIcon className={cn("animate-spin", className)} {...props} />
);

const Pinwheel = ({ className, ...props }: SpinnerVariantProps) => (
  <LoaderPinwheelIcon className={cn("animate-spin", className)} {...props} />
);

const CircleFilled = ({ className, size = 24, ...props }: SpinnerVariantProps) => (
  <div className="relative" style={{ width: size, height: size }}>
    <div className="absolute inset-0 rotate-180">
      <LoaderCircleIcon
        className={cn("animate-spin text-foreground opacity-20", className)}
        size={size}
        {...props}
      />
    </div>
    <LoaderCircleIcon className={cn("relative animate-spin", className)} size={size} {...props} />
  </div>
);

export type SpinnerProps = LucideProps & {
  variant?: "default" | "throbber" | "pinwheel" | "circle-filled";
};

/** Kibo UI spinner — Lucide-based, no external shadcn-repo dep. */
export const Spinner = ({ variant = "default", className, ...props }: SpinnerProps) => {
  switch (variant) {
    case "throbber":
      return <Throbber className={className} {...props} />;
    case "pinwheel":
      return <Pinwheel className={className} {...props} />;
    case "circle-filled":
      return <CircleFilled className={className} {...props} />;
    default:
      return <LoaderCircleIcon className={cn("size-6 animate-spin text-primary", className)} {...props} />;
  }
};
