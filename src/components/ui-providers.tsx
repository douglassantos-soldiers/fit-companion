import type { ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { MantineProvider } from "@mantine/core";
import { mantineTheme, muiTheme } from "@/lib/ui-theme";

/**
 * Order: MUI → Mantine → children.
 * HeroUI v3 has no JS ThemeProvider — themed via CSS tokens in styles.css.
 * Shadcn/Radix consume CSS variables; DaisyUI v5 uses --color-* bridge.
 * App is always dark (Soldiers).
 */
export function UiProviders({ children }: { children: ReactNode }) {
  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline enableColorScheme />
      <MantineProvider theme={mantineTheme} forceColorScheme="dark" defaultColorScheme="dark">
        {children}
      </MantineProvider>
    </MuiThemeProvider>
  );
}
