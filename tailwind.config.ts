import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd0ff",
          300: "#8eb0ff",
          400: "#5984ff",
          500: "#345bff",
          600: "#1d3bf5",
          700: "#162ce1",
          800: "#1826b6",
          900: "#1a278f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
