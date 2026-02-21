import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // headlin.ing design tokens
        bg: "#0A0A0A",
        surface: "#111111",
        "surface-hover": "#1A1A1A",
        border: "#222222",
        "border-light": "#333333",
        text: "#F5F5F5",
        muted: "#888888",
        dim: "#555555",
        accent: "#FF3D00",
        "accent-soft": "#FF6B3D",
        "accent-glow": "rgba(255, 61, 0, 0.15)",
        purple: "#AA00FF",
        blue: "#448AFF",
        green: "#00E676",
        yellow: "#FFD600",
      },
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        tight: "-0.03em",
      },
    },
  },
  plugins: [],
};

export default config;
