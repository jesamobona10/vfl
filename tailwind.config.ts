import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f7c45",
          dark: "#0a5d34",
        },
        accent: "#d99a21",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
        },
        muted: "rgb(var(--muted) / <alpha-value>)",
        danger: "#b42318",
        text: "rgb(var(--text) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        bg: "rgb(var(--bg) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
