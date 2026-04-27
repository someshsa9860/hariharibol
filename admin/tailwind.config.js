/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#C75A1A',
        secondary: '#8B4513',
        accent: '#DAA520',
        light: '#FBF7EF',
        dark: '#1A1410',
      },
    },
  },
  plugins: [],
};
