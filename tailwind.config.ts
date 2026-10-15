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
          dark: "var(--brand-dark)",
          50: "rgb(var(--brand-50-rgb) / <alpha-value>)",
          100: "rgb(var(--brand-100-rgb) / <alpha-value>)",
          500: "#0F7C45",
          600: "rgb(var(--brand-600-rgb) / <alpha-value>)",
          700: "var(--brand-700)",
        },
        gold: {
          DEFAULT: "#D99A21",
          500: "#D99A21",
          700: "var(--gold-700)",
          tint: "rgb(var(--gold-tint-rgb) / <alpha-value>)",
        },
        live: {
          DEFAULT: "#0F9D6B",
          500: "#0F9D6B",
          tint: "rgb(var(--live-tint-rgb) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "#C23B2E",
          500: "#C23B2E",
          tint: "rgb(var(--danger-tint-rgb) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "#B67D16",
          500: "#B67D16",
          tint: "rgb(var(--warn-tint-rgb) / <alpha-value>)",
        },
        upcoming: {
          DEFAULT: "#1D4ED8",
          500: "var(--upcoming-500)",
          tint: "rgb(var(--upcoming-tint-rgb) / <alpha-value>)",
        },
        finished: {
          DEFAULT: "#3F4A41",
          500: "var(--finished-500)",
          tint: "rgb(var(--finished-tint-rgb) / <alpha-value>)",
        },
        cancelled: {
          DEFAULT: "#6B4A46",
          500: "var(--cancelled-500)",
          tint: "rgb(var(--cancelled-tint-rgb) / <alpha-value>)",
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
          3: "rgb(var(--ink-3, 147 160 146) / <alpha-value>)",
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
      fontSize: {
        title: ["19px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        section: ["15px", { lineHeight: "1.4" }],
        body: ["14px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.4" }],
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
