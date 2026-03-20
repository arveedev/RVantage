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
        aura: {
          black: '#050505',
          card: '#121212',
          accent: '#00D1FF', // Financial Intelligence Cyan
          subtle: '#A1A1AA',
        }
      },
      zIndex: {
        '50': '50', // For the Glance Bar
      }
    },
  },
  plugins: [],
}