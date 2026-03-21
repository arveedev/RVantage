/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Essential for the "Aura" dark theme
  theme: {
    extend: {
      colors: {
        white: '#FFFFFF',
        black: '#000000',
        aura: {
          black: '#050505',
          card: '#121212',
          accent: '#00D1FF', // Financial Intelligence Cyan
          subtle: '#A1A1AA',
        },
        // Adding specific functional colors used in Dashboard logic
        red: {
          500: '#EF4444',
          600: '#DC2626',
        },
        yellow: {
          500: '#EAB308',
        }
      },
      zIndex: {
        '50': '50', // For the Glance Bar
        '60': '60',
        '100': '100',
        '200': '200',
        '250': '250',
      },
      boxShadow: {
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.6)',
      }
    },
  },
  plugins: [],
}