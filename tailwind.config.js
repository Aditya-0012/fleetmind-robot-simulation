/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hull: { 950: '#060A14', 900: '#0A1020', 850: '#0E1528', 800: '#121B33', 700: '#1A2542', 600: '#26355C', 500: '#3A4C7A' },
        ink: { 100: '#E8EEFA', 200: '#C3CDE3', 300: '#94A2C2', 400: '#6B7A9E' },
        signal: { cyan: '#2BD9F2', blue: '#4C8DFF', violet: '#9B7BFF', green: '#3EE6A0', amber: '#FFC247', red: '#FF5470' },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(43,217,242,.25), 0 0 24px -6px rgba(43,217,242,.45)',
      },
    },
  },
  plugins: [],
};
