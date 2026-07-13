/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ── COLORS ──────────────────────────────
      colors: {
        brand: "#F27F0D",        // SugboGo orange
        dark: "#1A1A1A",         // main text
        muted: "#666666",        // subtitle/gray text
        placeholder: "#999999",  // skip button, disabled text
        surface: "#fcf9f9",      // card/top bar bg
        background: "#ebe8e8",   // screen bg
        disabled: "#E5E7EB",     // disabled button bg
        border: "#E5E7EB",       // input borders
        error: "#DC2626",        // error/validation text
        success: "#16A34A",      // success states
        white: "#FFFFFF",        // pure white
      },

      // ── FONT SIZES ───────────────────────────
      fontSize: {
        xs: "11px",       // labels (EMAIL ADDRESS, PASSWORD)
        small: "12px",    // skip button, counter text
        body: "14px",     // regular text, inputs
        md: "16px",       // button text
        lg: "20px",       // card titles (Login to your account)
        h2: "30px",       // section headers
        h1: "40px",       // hero text (What interests you?)
      },

      // ── FONT WEIGHTS ─────────────────────────
      fontWeight: {
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },

      // ── BORDER RADIUS ────────────────────────
      borderRadius: {
        tag: "999px",     // for interest tags (fully rounded)
        btn: "12px",      // for buttons
        card: "16px",     // for cards
        input: "8px",     // for input fields
      },

      // ── SPACING ──────────────────────────────
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "screen-x": "24px",   // horizontal screen padding
        "screen-top": "60px", // top padding for screens
      },

      // ── SHADOWS (for inline style reference) ─
      // Note: NativeWind shadow support is limited
      // Use these as reference for inline styles:
      // shadow-sm = elevation: 2
      // shadow-md = elevation: 4
      // shadow-lg = elevation: 8
    },
  },
  plugins: [],
};