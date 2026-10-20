/** @type {import('tailwindcss').Config} */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: token('border'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        accent: token('accent'),
        risk: {
          critical: token('risk-critical'),
          high: token('risk-high'),
          medium: token('risk-medium'),
          low: token('risk-low'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
