/**
 * LocalFinder design tokens.
 *
 * Everything visual in the product comes from this file: there are no
 * ad-hoc hex values in components. The palette is a premium-minimal SaaS
 * light theme with a single AI accent, so the interface stays calm and the
 * violet actually means something when it appears.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC", // page background
        surface: "#FFFFFF", // cards, sheets, inputs
        line: {
          DEFAULT: "#E2E8F0", // borders, dividers
          strong: "#CBD5E1",
        },
        ink: {
          DEFAULT: "#172554", // headings (navy)
          soft: "#334155", // body copy
          muted: "#64748B", // secondary text
          faint: "#94A3B8", // captions, placeholders
        },
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB", // primary
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        ai: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          400: "#A78BFA",
          500: "#8B5CF6", // AI accent
          600: "#7C3AED",
          700: "#6D28D9",
        },
        success: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        card: "16px",
        xl2: "20px",
      },
      boxShadow: {
        // Three steps only: resting, hovered, floating. More than that and
        // elevation stops meaning anything.
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 2px 4px -1px rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)",
        lift: "0 8px 16px -4px rgb(15 23 42 / 0.08), 0 20px 40px -12px rgb(15 23 42 / 0.16)",
        ring: "0 0 0 4px rgb(37 99 235 / 0.12)",
      },
      maxWidth: {
        content: "1200px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "70%": { transform: "scale(2.2)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-5px)", opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 5s ease-in-out infinite",
        "bounce-dot": "bounce-dot 1.2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};
