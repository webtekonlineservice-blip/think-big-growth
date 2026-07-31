/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0056b3',
          'blue-dark': '#003d80',
          orange: '#ff6a00',
          'orange-dark': '#cc5500',
        },
      },
    },
  },
  plugins: [],
}
