import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111714",
        panel: "#19211d",
        lime: "#c5f36b",
      },
      boxShadow: {
        glow: "0 0 60px rgba(197, 243, 107, .12)",
      },
    },
  },
  plugins: [],
};

export default config;
