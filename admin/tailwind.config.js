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
        primary: {
          DEFAULT: '#FF6B2B',
          50:  '#FFF3ED',
          100: '#FFE4D0',
          200: '#FFC5A0',
          300: '#FF9E6B',
          400: '#FF7A3D',
          500: '#FF6B2B',
          600: '#E55A1A',
          700: '#C04A12',
          800: '#9A3A0D',
          900: '#742C09',
        },
        gold: {
          DEFAULT: '#F5C842',
          400: '#F9D96A',
          500: '#F5C842',
          600: '#D4A918',
        },
        saffron: '#FF9933',
        surface: {
          DEFAULT: '#0D0A0E',
          50:  '#1A1520',
          100: '#231C2C',
          200: '#2E2438',
        },
        dark:     '#0D0A0E',
        muted:    '#9B8FA8',
        light:    '#F8F4FF',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow:        '0 0 30px rgba(255,107,43,0.25)',
        'glow-gold': '0 0 30px rgba(245,200,66,0.2)',
        'glow-sm':   '0 0 12px rgba(255,107,43,0.3)',
        card:        '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':'0 8px 32px rgba(255,107,43,0.18)',
        glass:       'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.3)',
        float:       '0 20px 60px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'gradient-saffron': 'linear-gradient(135deg, #FF6B2B 0%, #F5C842 100%)',
        'gradient-cosmic':  'linear-gradient(135deg, #1A0533 0%, #0D0A0E 50%, #1A1008 100%)',
        'gradient-card':    'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'float':          'float 6s ease-in-out infinite',
        'float-delayed':  'float 6s ease-in-out infinite 2s',
        'float-slow':     'float 9s ease-in-out infinite 1s',
        'spin-slow':      'spin 20s linear infinite',
        'spin-reverse':   'spin-reverse 15s linear infinite',
        'pulse-glow':     'pulse-glow 3s ease-in-out infinite',
        'shimmer':        'shimmer 2.5s linear infinite',
        'slide-up':       'slide-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-left':  'slide-in-left 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':        'fade-in 0.5s ease both',
        'scale-in':       'scale-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'draw':           'draw 1.5s ease forwards',
        'count-up':       'count-up 0.8s cubic-bezier(0.16,1,0.3,1) both',
        'meteor':         'meteor 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':     { transform: 'translateY(-18px) rotate(1deg)' },
          '66%':     { transform: 'translateY(-8px) rotate(-1deg)' },
        },
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to:   { transform: 'rotate(0deg)' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':     { opacity: '1',   transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        meteor: {
          '0%':   { transform: 'translateY(-100%) translateX(0)', opacity: '1' },
          '70%':  { opacity: '1' },
          '100%': { transform: 'translateY(300%) translateX(-300px)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
