import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { mantineTheme } from "@/lib/ui-theme";

/**
 * Mantine only (NumberInput / Modal on a few screens).
 * MUI removed from root — no product imports of @mui components.
 * HeroUI v3 has no JS ThemeProvider — themed via CSS tokens in styles.css.
 * Shadcn/Radix consume CSS variables; DaisyUI v5 uses --color-* bridge.
 * App is always dark (Soldiers).
 */
export function UiProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark" defaultColorScheme="dark">
      {children}
    </MantineProvider>
  );
}
