/** @type {import('tailwindcss').Config} */
const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          DEFAULT: channel('--og-bg-rgb'),
          raised: channel('--og-surface-rgb'),
          card: channel('--og-elevated-rgb'),
          overlay: channel('--og-overlay-rgb'),
        },
        ink: channel('--og-text-rgb'),
        accent: {
          cyan: channel('--og-cyan-rgb'),
          mint: channel('--og-mint-rgb'),
          coral: channel('--og-coral-rgb'),
          amber: channel('--og-amber-rgb'),
          violet: channel('--og-violet-rgb'),
          danger: channel('--og-danger-rgb'),
        },
      },
      boxShadow: {
        panel: '0 30px 60px -40px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'panel-glow': '0 30px 80px -50px rgba(34, 225, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        brutal: '4px 4px 0 -1.5px rgb(var(--og-bg-rgb)), 4px 4px 0 0 rgb(var(--og-cyan-rgb))',
      },
      borderRadius: {
        og: 'var(--og-radius-md)',
      },
      keyframes: {
        'og-rise': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'og-rise': 'og-rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
