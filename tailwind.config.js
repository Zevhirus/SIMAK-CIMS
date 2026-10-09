export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: { navy: '#0B1F44', brand: '#2F6BFF', surface: '#F3F6FC', lime: '#D9F46A', mint: '#E6EDFA' },
      boxShadow: {
        soft: '0 1px 2px rgba(11,31,68,.05), 0 12px 28px -14px rgba(11,31,68,.18)',
        lift: '0 2px 4px rgba(11,31,68,.06), 0 20px 36px -16px rgba(47,107,255,.35)',
      },
      keyframes: {
        pop: { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        sweep: { '0%,100%': { transform: 'translateX(-30%)' }, '50%': { transform: 'translateX(30%)' } },
      },
      animation: { pop: 'pop .18s ease-out', rise: 'rise .35s ease-out both', sweep: 'sweep 6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
