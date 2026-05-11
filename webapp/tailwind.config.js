/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: '#C75A1A',
          light: '#E8722A',
          50: '#FDF3EC', 100: '#F9E0CB', 200: '#F2B98A',
          300: '#E8914A', 400: '#D96E28', 500: '#C75A1A',
          600: '#A0450F', 700: '#7A320A',
        },
        gold: { DEFAULT: '#D4A055', light: '#E8C07A', dark: '#B07830' },
        cream: { DEFAULT: '#FBF7EF', dark: '#F2EAD8' },
        warmBlack: '#1A1410',
        warmGray: '#6B5744',
      },
      fontFamily: {
        serif: ['Georgia', 'Playfair Display', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        devanagari: ['Noto Sans Devanagari', 'serif'],
      },
    },
  },
  plugins: [],
};
