/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0b0f19',
          raised: '#111827',
          card: '#1a2234',
          overlay: '#1f2937',
        },
      },
      boxShadow: {
        panel: '0 4px 24px -4px rgba(0, 0, 0, 0.45)',
        'panel-glow': '0 0 32px -8px rgba(6, 182, 212, 0.15)',
      },
      borderRadius: {
        og: '0.75rem',
      },
    },
  },
  plugins: [],
};
