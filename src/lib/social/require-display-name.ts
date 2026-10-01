import { toast } from "sonner";

/** Guard social joins — returns false and toasts when display name is missing. */
export function requireDisplayName(
  name: string | null | undefined,
  action = "participar",
): name is string {
  if (name?.trim()) return true;
  toast.error(`Defina seu nome no Perfil para ${action}`);
  return false;
}
