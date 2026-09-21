import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import { SOLDIERS_BORDER, SOLDIERS_CARD, SOLDIERS_FG, SOLDIERS_YELLOW } from "@/lib/ui-theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Sonner defaults to light (--normal-bg white). Force Soldiers dark tokens.
 * Never use DaisyUI class `toast` here — it breaks Sonner flex layout. */
const toastVars = {
  "--normal-bg": SOLDIERS_CARD,
  "--normal-text": SOLDIERS_FG,
  "--normal-border": SOLDIERS_BORDER,
  "--success-bg": SOLDIERS_CARD,
  "--success-text": SOLDIERS_FG,
  "--success-border": SOLDIERS_YELLOW,
  "--error-bg": SOLDIERS_CARD,
  "--error-text": SOLDIERS_FG,
  "--error-border": "#E62B34",
  "--border-radius": "1rem",
} as CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={toastVars}
      toastOptions={{
        style: {
          background: SOLDIERS_CARD,
          color: SOLDIERS_FG,
          border: `1px solid ${SOLDIERS_BORDER}`,
        },
        classNames: {
          toast: "group soldiers-toast shadow-lg",
          title: "font-semibold",
          description: "opacity-90",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
