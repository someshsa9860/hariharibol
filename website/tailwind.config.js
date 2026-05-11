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
          light:   '#E8722A',
          dark:    '#A0450F',
          50:      '#FDF3EC',
          100:     '#F9E0CB',
          200:     '#F2B98A',
          300:     '#E8914A',
          400:     '#D96E28',
          500:     '#C75A1A',
          600:     '#A0450F',
          700:     '#7A320A',
          800:     '#562208',
          900:     '#321405',
        },
        gold: {
          DEFAULT: '#D4A055',
          light:   '#E8C07A',
          dark:    '#B07830',
        },
        cream: {
          DEFAULT: '#FBF7EF',
          dark:    '#F2EAD8',
        },
        warmBlack: '#1A1410',
        warmGray:  '#6B5744',
      },
      fontFamily: {
        serif:   ['Georgia', 'Playfair Display', 'serif'],
        sans:    ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        devanagari: ['Noto Sans Devanagari', 'serif'],
      },
      backgroundImage: {
        'gradient-saffron': 'linear-gradient(135deg, #C75A1A 0%, #D4A055 100%)',
        'gradient-warm':    'linear-gradient(135deg, #FBF7EF 0%, #F2EAD8 100%)',
        'gradient-dark':    'linear-gradient(135deg, #1c0f07 0%, #0d0906 100%)',
      },
      boxShadow: {
        verse:  '0 2px 16px rgba(199,90,26,0.10)',
        card:   '0 4px 24px rgba(26,20,16,0.08)',
        glow:   '0 0 30px rgba(199,90,26,0.20)',
      },
      animation: {
        'float':       'float 7s ease-in-out infinite',
        'spin-slow':   'spin 20s linear infinite',
        'pulse-glow':  'pulse-glow 3s ease-in-out infinite',
        'shimmer':     'shimmer 2s linear infinite',
        'slide-up':    'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':     'fade-in 0.4s ease both',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-14px)' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%':     { opacity: '1',   transform: 'scale(1.04)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
