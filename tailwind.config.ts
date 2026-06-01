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
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        muted: "var(--muted)",
        danger: "#b42318",
        text: "var(--text)",
        line: "var(--line)",
        bg: "var(--bg)",
      },
    },
  },
  plugins: [],
};

export default config;
