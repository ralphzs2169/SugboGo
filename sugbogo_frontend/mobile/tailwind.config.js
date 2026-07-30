/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ── COLORS ──────────────────────────────
      colors: {
        brand: "#F27F0D", // SugboGo orange
        background: "#F3F4F6", // screen bg
        surface: "#FFFFFF", // card/top bar bg

        placeholder: "#999999", // skip button, disabled text

        disabled: "#E5E7EB", // disabled button bg
        border: "#E5E7EB", // input borders
        error: "#DC2626", // error/validation text
        success: "#16A34A", // success states
        white: "#FFFFFF", // pure white

        text: {
          primary: "#1A1A1A",
          secondary: "#666666",
          tertiary: "#999999",
        },
      },

      // ── FONT SIZES ───────────────────────────
      fontSize: {
        xs: "11px", // labels (EMAIL ADDRESS, PASSWORD)
        small: "12px", // skip button, counter text
        body: "14px", // regular text, inputs
        md: "16px", // button text
        lg: "20px", // card titles (Login to your account)
        h2: "30px", // section headers
        h1: "40px", // hero text (What interests you?)
      },

      // ── BORDER RADIUS ────────────────────────
      borderRadius: {
        tag: "999px", // for interest tags (fully rounded)
        btn: "12px", // for buttons
        card: "16px", // for cards
        input: "8px", // for input fields
      },

      // ── SPACING ──────────────────────────────
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "screen-x": "24px", // horizontal screen padding
        "screen-top": "60px", // top padding for screens
      },
    },
  },
  plugins: [],
};
