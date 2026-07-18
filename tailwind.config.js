export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        surface: {
          DEFAULT: '#0a0a0b',
          hover: '#141416',
          glass: 'rgba(5, 5, 5, 0.6)',
        },
        border: {
          DEFAULT: '#1c1c1f',
          subtle: 'rgba(0, 242, 255, 0.1)',
        },
        text: {
          primary: '#f0f2f5',
          secondary: '#9ca3af',
          muted: '#6b7280',
        },
        accent: {
          DEFAULT: '#00f2ff', 
          hover: '#00ddec',
          light: '#70f9ff',
          glow: 'rgba(0, 242, 255, 0.4)',
          muted: 'rgba(0, 242, 255, 0.1)',
        },
        cyber: {
          cyan: '#00f2ff',
          pink: '#ff00ff',
          blue: '#0066ff',
        },
        rating: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        'nav': '70px',
        'sidebar': '240px',
        'sidebar-collapsed': '72px',
        'bottom-nav': '72px',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      screens: {
        'xs': '480px',
        'tv': '1280px',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'fade-out': 'fadeOut 0.3s ease-in forwards',
        'scale-in': 'scaleIn 0.2s ease-out',
        'cyber-hue-shift': 'cyberHueShift 8s linear infinite',
        'rgb-shift': 'cyberHueShift 8s linear infinite',
      },
      keyframes: {
        cyberHueShift: {
          '0%': { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundSize: {
        'shimmer': '200% 100%',
      },
    },
  },
  plugins: [],
};