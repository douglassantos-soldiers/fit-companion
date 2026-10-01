import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/** Shared fallback UI for TanStack route errors and React error boundaries. */
export function RouteErrorFallback({
  error,
  reset,
  boundary = "route_error_fallback",
}: {
  error: Error;
  reset: () => void;
  boundary?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary });
  }, [error, boundary]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Essa tela não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente novamente ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}

type BoundaryProps = {
  children: ReactNode;
  boundary?: string;
};

type BoundaryState = { error: Error | null };

/** React class boundary for authenticated shell / feature trees. */
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, {
      boundary: this.props.boundary ?? "app_error_boundary",
      componentStack: info.componentStack,
    });
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <RouteErrorFallback
        error={error}
        reset={() => this.setState({ error: null })}
        boundary={this.props.boundary ?? "app_error_boundary"}
      />
    );
  }
}

/** TanStack Router errorComponent factory. */
export function createRouteErrorComponent(boundary: string) {
  return function RouteErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
    return <RouteErrorFallback error={error} reset={reset} boundary={boundary} />;
  };
}
