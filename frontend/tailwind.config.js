/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: 'var(--og-bg)',
          raised: 'var(--og-surface)',
          card: 'var(--og-elevated)',
          overlay: 'var(--og-overlay)',
        },
        accent: {
          mint: 'var(--og-mint)',
          coral: 'var(--og-coral)',
          amber: 'var(--og-amber)',
          violet: 'var(--og-violet)',
          danger: 'var(--og-danger)',
        },
      },
      boxShadow: {
        panel: '0 16px 40px -28px rgba(0, 0, 0, 0.85)',
        'panel-glow': '0 18px 48px -30px rgba(141, 224, 188, 0.28)',
      },
      borderRadius: {
        og: 'var(--og-radius-md)',
      },
    },
  },
  plugins: [],
};
