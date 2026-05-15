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
          dark: "#0a5d34",
        },
        accent: "#d99a21",
        surface: {
          DEFAULT: "#ffffff",
          2: "#eef4ec",
        },
        muted: "#66736a",
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
