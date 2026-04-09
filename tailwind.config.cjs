/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        temu: {
          DEFAULT: '#FF5722',
          dark: '#E64A19',
          light: '#FF7043',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        urgent: '0 4px 20px rgba(255, 87, 34, 0.35)',
      },
    },
  },
  plugins: [],
}
