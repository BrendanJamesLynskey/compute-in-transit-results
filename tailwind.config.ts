import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}", "./content/**/*.{md,mdx}"],
  // Follow the OS setting (CLAUDE.md §5: "default is system preference").
  // This was "class", but nothing ever set the class, so every `dark:`
  // variant was dead and the site was light-only.
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        // Accent: the Compute in Transit series' teal (#6cb6c4, the decks'
        // accent) for dark mode, and a darker teal on white so text keeps a
        // contrast above 4.5:1 (5.8:1).
        accent: {
          DEFAULT: "#1f6f7d",
          light: "#6cb6c4",
          fg: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
