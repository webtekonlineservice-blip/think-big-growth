/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Webtek Indigo (primary — your brand)
          indigo: '#4F46E5',
          'indigo-dark': '#3730A3',
          'indigo-light': '#818CF8',
          // BNI Red (chapter identity)
          red: '#CC0000',
          'red-dark': '#990000',
          'red-light': '#FF3333',
          // Accent — warm gold (bridges BNI red + professional tone)
          gold: '#D4A017',
          'gold-dark': '#B8860B',
          'gold-light': '#F0C040',
          // Cyan (CTAs and highlights)
          cyan: '#06B6D4',
          'cyan-dark': '#0891B2',
          // Legacy aliases (backward compat)
          blue: '#4F46E5',
          'blue-dark': '#3730A3',
          orange: '#CC0000',
          'orange-dark': '#990000',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
        'gradient-bni': 'linear-gradient(135deg, #CC0000 0%, #990000 100%)',
      },
    },
  },
  plugins: [],
}
