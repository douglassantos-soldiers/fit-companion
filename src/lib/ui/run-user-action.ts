import { toast } from "sonner";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type RunUserActionOptions = {
  errorMessage?: string;
  /** Forward to Lovable capture (default true). */
  report?: boolean;
};

/**
 * Wrap a user-initiated async mutation with toast + optional error reporting.
 * Returns undefined on failure so callers can early-return.
 */
export async function runUserAction<T>(
  action: () => Promise<T>,
  opts: RunUserActionOptions = {},
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    toast.error(opts.errorMessage ?? "Algo deu errado. Tente de novo.");
    if (opts.report !== false) {
      reportLovableError(error, { boundary: "run_user_action" });
    }
    return undefined;
  }
}
