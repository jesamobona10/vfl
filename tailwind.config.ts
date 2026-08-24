import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f7c45",
          dark: "#0b5f35",
          50: "#EAF6EE",
          100: "#CFEBD8",
          500: "#0F7C45",
          600: "#0B5F35",
          700: "#084526",
        },
        gold: {
          DEFAULT: "#D99A21",
          500: "#D99A21",
          700: "#8C6110",
          tint: "#FBF0DC",
        },
        live: {
          DEFAULT: "#0F9D6B",
          500: "#0F9D6B",
          tint: "#E4F6EE",
        },
        danger: {
          DEFAULT: "#C23B2E",
          500: "#C23B2E",
          tint: "#FBEAE8",
        },
        warn: {
          DEFAULT: "#B67D16",
          500: "#B67D16",
          tint: "#FBF0DC",
        },
        accent: "#d99a21",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
        },
        muted: "rgb(var(--muted) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        bg: "rgb(var(--bg) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          2: "rgb(var(--muted) / <alpha-value>)",
          3: "rgb(var(--ink-3, 147, 160, 146) / <alpha-value>)",
        },
        page: "rgb(var(--bg) / <alpha-value>)",
        panel: "rgb(var(--surface) / <alpha-value>)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
