/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        surface: "#161922",
        "surface-raised": "#1c2029",
        border: "#1f2937",
        "border-light": "#2a2d3e",
        muted: "#9ca3af",
        accent: "#22c55e",
        "accent-hover": "#16a34a",
        "accent-dim": "rgba(34,197,94,0.14)",
        danger: "#f87171",
        "danger-dim": "rgba(248,113,113,0.12)",
      },
    },
  },
  plugins: [],
};
