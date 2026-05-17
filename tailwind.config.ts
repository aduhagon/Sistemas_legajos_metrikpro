import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce6fd',
          500: '#2f5de8',
          600: '#1e3a5f',
        },
      },
      keyframes: {
        scan: {
          '0%':   { top: '8px' },
          '50%':  { top: 'calc(100% - 8px)' },
          '100%': { top: '8px' },
        },
      },
      animation: {
        scan: 'scan 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
