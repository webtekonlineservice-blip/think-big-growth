/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary — Webtek indigo (from logo "Web")
          indigo: '#4F46E5',
          'indigo-dark': '#3730A3',
          'indigo-light': '#818CF8',
          // Accent — cyan for CTAs and highlights
          cyan: '#06B6D4',
          'cyan-dark': '#0891B2',
          // Legacy aliases so existing components don't break
          blue: '#4F46E5',
          'blue-dark': '#3730A3',
          orange: '#06B6D4',
          'orange-dark': '#0891B2',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
      },
    },
  },
  plugins: [],
}
