/**
 * Soldiers multi-lib UI map (use the right kit for each job):
 * - Shadcn/Radix → buttons, cards, progress, skeleton, forms, toaster
 * - Magic UI → NumberTicker, ShinyButton, AnimatedCircularProgressBar
 * - Kibo UI → Spinner
 * - HeroUI → AppShell bottom tabs / chips (CSS tokens only — no JS ThemeProvider in v3)
 * - Mantine → NumberInput + dense dialogs
 * - MUI → ToggleButtonGroup (RPE)
 * - Headless UI → SoldiersOverlay (meal / swap / summary)
 * - DaisyUI → badge/stats utilities (themes: false)
 *
 * Dual-source tokens:
 * - CSS oklch in styles.css → Shadcn / DaisyUI v5 / HeroUI
 * - Hex palette below → MUI / Mantine (Emotion & Mantine don't read Tailwind oklch)
 * Hex values are calibrated to the dark oklch tokens in styles.css.
 *
 * App is always dark (Soldiers). No light-mode runtime toggle.
 */
import { createTheme } from "@mui/material/styles";
import { createTheme as createMantineTheme } from "@mantine/core";

/** oklch(0.86 0.18 96) */
export const SOLDIERS_YELLOW = "#F4CF00";
/** oklch(0.14 0 0) — deep black */
export const SOLDIERS_BG = "#161616";
/** oklch(0.19 0 0) — visually matched to --card in-browser */
export const SOLDIERS_CARD = "#222222";
/** oklch(0.97 0 0) */
export const SOLDIERS_FG = "#F5F5F5";
/** oklch(0.15 0 0) — on primary */
export const SOLDIERS_PRIMARY_FG = "#141414";
/** oklch(0.25 0 0) */
export const SOLDIERS_SECONDARY = "#2E2E2E";
/** oklch(0.24 0 0) */
export const SOLDIERS_MUTED = "#2A2A2A";
/** oklch(0.68 0 0) */
export const SOLDIERS_MUTED_FG = "#989898";
/** oklch(0.28 0 0) */
export const SOLDIERS_BORDER = "#383838";
/** oklch(0.72 0.17 150) */
export const SOLDIERS_SUCCESS = "#3FC168";
/** oklch(0.6 0.22 25) */
export const SOLDIERS_DESTRUCTIVE = "#E62B34";

export const muiTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: SOLDIERS_YELLOW,
      contrastText: SOLDIERS_PRIMARY_FG,
    },
    secondary: {
      main: SOLDIERS_SECONDARY,
      contrastText: SOLDIERS_FG,
    },
    background: {
      default: SOLDIERS_BG,
      paper: SOLDIERS_CARD,
    },
    text: {
      primary: SOLDIERS_FG,
      secondary: SOLDIERS_MUTED_FG,
    },
    divider: SOLDIERS_BORDER,
    success: {
      main: SOLDIERS_SUCCESS,
      contrastText: SOLDIERS_PRIMARY_FG,
    },
    error: {
      main: SOLDIERS_DESTRUCTIVE,
      contrastText: SOLDIERS_FG,
    },
  },
  typography: {
    fontFamily: '"Barlow", system-ui, sans-serif',
    h1: { fontFamily: '"Anton", "Barlow Condensed", sans-serif', textTransform: "uppercase" },
    h2: { fontFamily: '"Anton", "Barlow Condensed", sans-serif', textTransform: "uppercase" },
    h3: { fontFamily: '"Anton", "Barlow Condensed", sans-serif', textTransform: "uppercase" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Do not replace Soldiers body background/font from styles.css @layer base
        body: {
          backgroundColor: "transparent",
          color: "inherit",
          fontFamily: "inherit",
        },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: false },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: SOLDIERS_BORDER,
          color: SOLDIERS_MUTED_FG,
          textTransform: "none",
          "&.Mui-selected": {
            backgroundColor: SOLDIERS_YELLOW,
            color: SOLDIERS_PRIMARY_FG,
            "&:hover": {
              backgroundColor: SOLDIERS_YELLOW,
              filter: "brightness(0.95)",
            },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        grouped: {
          borderColor: SOLDIERS_BORDER,
        },
      },
    },
  },
});

export const mantineTheme = createMantineTheme({
  primaryColor: "yellow",
  primaryShade: { light: 5, dark: 5 },
  fontFamily: '"Barlow", system-ui, sans-serif',
  headings: {
    fontFamily: '"Anton", "Barlow Condensed", sans-serif',
  },
  colors: {
    yellow: [
      "#FFF9DB",
      "#FFF3BF",
      "#FFEC99",
      "#FFE066",
      "#FFD43B",
      SOLDIERS_YELLOW,
      "#E6C200",
      "#C9A800",
      "#A88C00",
      "#7A6600",
    ],
    dark: [
      SOLDIERS_FG,
      SOLDIERS_MUTED_FG,
      "#909296",
      "#5C5F66",
      SOLDIERS_BORDER,
      SOLDIERS_SECONDARY,
      SOLDIERS_CARD,
      "#1A1B1E",
      SOLDIERS_BG,
      "#101113",
    ],
  },
  defaultRadius: "md",
  other: {
    soldiersBrand: "Soldiers Training",
  },
  components: {
    Modal: {
      defaultProps: {
        centered: true,
        radius: "md",
        overlayProps: { backgroundOpacity: 0.6, blur: 2 },
      },
      styles: {
        content: {
          backgroundColor: SOLDIERS_CARD,
          border: `1px solid ${SOLDIERS_BORDER}`,
        },
        header: {
          backgroundColor: SOLDIERS_CARD,
          color: SOLDIERS_FG,
        },
        title: {
          fontFamily: '"Anton", "Barlow Condensed", sans-serif',
          textTransform: "uppercase",
          letterSpacing: "0.01em",
        },
        body: {
          color: SOLDIERS_FG,
        },
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});
