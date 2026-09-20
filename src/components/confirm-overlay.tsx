import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { Button } from "@/components/ui/button";

export function ConfirmOverlay({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <SoldiersOverlay
      open={open}
      onClose={onClose}
      title={title}
      {...(description ? { description } : {})}
    >
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          className="flex-1"
          variant={destructive ? "secondary" : "default"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          <span {...(destructive ? { className: "text-destructive" } : {})}>{confirmLabel}</span>
        </Button>
      </div>
    </SoldiersOverlay>
  );
}
