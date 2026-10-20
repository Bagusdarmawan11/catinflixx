import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "cf-bg": "var(--cf-bg)",
        "cf-bg-secondary": "var(--cf-bg-secondary)",
        "cf-bg-card": "var(--cf-bg-card)",
        "cf-bg-elevated": "var(--cf-bg-elevated)",
        "cf-border": "var(--cf-border)",
        "cf-border-subtle": "var(--cf-border-subtle)",
        "cf-text": "var(--cf-text)",
        "cf-text-secondary": "var(--cf-text-secondary)",
        "cf-text-muted": "var(--cf-text-muted)",
        "cf-accent": "var(--cf-accent)",
        "cf-accent-hover": "var(--cf-accent-hover)",
        "cf-success": "var(--cf-success)",
        "cf-warning": "var(--cf-warning)",
        "cf-error": "var(--cf-error)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        cf: "var(--cf-radius)",
        "cf-sm": "var(--cf-radius-sm)",
        "cf-lg": "var(--cf-radius-lg)",
        "cf-xl": "var(--cf-radius-xl)",
      },
      boxShadow: {
        cf: "var(--cf-shadow)",
        "cf-lg": "var(--cf-shadow-lg)",
      },
      transitionDuration: {
        cf: "150ms",
      },
      aspectRatio: {
        poster: "2 / 3",
        backdrop: "16 / 9",
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
