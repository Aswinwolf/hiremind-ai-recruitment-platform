/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy:    "#0D1B2A",
        blue:    "#1E88E5",
        green:   "#27AE60",
        amber:   "#FF6F00",
        purple:  "#6A1B9A",
        coral:   "#C62828",
        ink:     "#212121",
        muted:   "#B0BEC5",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "Inter", "sans-serif"],
        body:    ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
