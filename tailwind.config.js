/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#fbfaf7",
        mint: "#dff3e7",
        coral: "#ffddd2",
        sky: "#dcecff"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 23, 23, 0.08)"
      }
    }
  },
  plugins: []
};
