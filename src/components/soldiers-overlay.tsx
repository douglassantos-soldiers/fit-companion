import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Fragment, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared Headless UI overlay for meal picker, swap, and session summary.
 * Styled with Soldiers surface-card tokens.
 */
export function SoldiersOverlay({
  open,
  onClose,
  title,
  description,
  children,
  className,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className={cn("relative z-50", className)} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              className={cn(
                "surface-card max-h-[70vh] w-full max-w-md overflow-y-auto p-5",
                panelClassName,
              )}
            >
              {title ? (
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle className="text-xl">{title}</DialogTitle>
                  <button type="button" onClick={onClose} aria-label="Fechar">
                    <X className="size-5 text-muted-foreground" />
                  </button>
                </div>
              ) : null}
              {description ? (
                <p className={cn("text-xs text-muted-foreground", title ? "mt-1" : undefined)}>
                  {description}
                </p>
              ) : null}
              <div className={title || description ? "mt-4" : undefined}>{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
