/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colore principale dell'app: il blu navy del logo CSAIN (#202048).
        // La scala 700/800 corrisponde alla tonalità del logo, usata su
        // pulsanti, voci attive, loghi e bordi dei diplomi.
        brand: {
          50: '#eef0f7',
          100: '#d9dcee',
          200: '#b7bce0',
          300: '#8d94cb',
          400: '#5f68af',
          500: '#3f4890',
          600: '#2f356f',
          700: '#262a5a',
          800: '#202048',
          900: '#17172f',
        },
        // Colori di accento presi dal logo CSAIN (verde, arancio, rosso),
        // disponibili per badge, evidenziazioni e dettagli grafici.
        csain: {
          navy: '#202048',
          green: '#088830',
          orange: '#f09000',
          red: '#c81028',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
