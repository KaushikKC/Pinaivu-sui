import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { surface: { DEFAULT: "#0a0a0b", 1: "#111113", 2: "#1a1a1e", 3: "#252529" }, accent: { DEFAULT: "#6366f1", hover: "#818cf8", dim: "#3730a3" }, muted: "#71717a" }, fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "Fira Code", "monospace"] } } },
  plugins: [],
} satisfies Config;
