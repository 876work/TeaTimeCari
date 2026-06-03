/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#4B9EC8',
          'blue-light': '#7BBDDD',
          'blue-dark': '#3382AA',
          'blue-muted': '#D6EBF5',
          rose: '#D96E6E',
          'rose-light': '#E89494',
          'rose-dark': '#BC5050',
          'rose-muted': '#F9E3E3',
        },
      },
    },
  },
  plugins: [],
};
