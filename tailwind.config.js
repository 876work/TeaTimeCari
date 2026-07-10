/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          muted: '#F1F5F9',
          border: '#E2E8F0',
          fg: '#0F172A',
          'muted-fg': '#64748B',
          brand: '#2563EB',
          'brand-hover': '#1D4ED8',
          success: '#059669',
          warning: '#D97706',
          danger: '#DC2626',
          info: '#0284C7',
        },
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
      borderRadius: {
        'admin-sm': '0.5rem',
        'admin-md': '0.625rem',
        'admin-lg': '0.75rem',
        'admin-xl': '1rem',
      },
      boxShadow: {
        'admin-sm': '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        admin: '0 12px 32px -24px rgb(15 23 42 / 0.35)',
      },
    },
  },
  plugins: [],
};
