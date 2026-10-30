/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable (see src/index.css), so light and dark mode share one set of class names.
const token = name => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: { DEFAULT: token('ink'), soft: token('ink-soft'), muted: token('ink-muted') },
        rule: token('rule'),
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), wash: token('accent-wash'), on: token('on-accent') },
        good: token('good'),
        warn: token('warn'),
        bad: token('bad'),
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: { card: '3px' },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        fade: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        fade: 'fade 180ms ease-out both',
      },
    },
  },
  plugins: [],
};
