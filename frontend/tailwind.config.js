/** Sistema de design transcript.ai — editorial preto e branco. Cores via CSS vars (index.css). */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      paper: 'var(--paper)',
      ink: 'var(--ink)',
      gray: 'var(--gray)',
      hairline: 'var(--hairline)',
      card: 'var(--card)',
      ok: '#16A34A',      // exclusivo: status concluido
      busy: '#D97706',    // exclusivo: em andamento
      err: '#DC2626',     // exclusivo: erro
      transparent: 'transparent',
    },
    fontFamily: {
      display: ['Archivo', 'sans-serif'],
      body: ['Inter', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'monospace'],
    },
    borderRadius: { none: '0', sm: '2px', DEFAULT: '2px', full: '999px' },
    extend: {},
  },
  plugins: [],
}
