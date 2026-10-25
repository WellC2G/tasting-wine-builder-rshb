import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        wine: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
      },
      boxShadow: {
        glow: '0 0 80px -20px rgba(244, 63, 94, 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: {
            opacity: '0',
            transform: 'translateY(14px) scale(0.985)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        'score-pop': {
          '0%': {
            opacity: '0.55',
            transform: 'scale(1.07)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },
      animation: {
        'fade-in':
          'fade-in 550ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'score-pop': 'score-pop 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
