/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Supporting Neutrals (Design System Specification)
        canvas: '#F4F3F1',           // Soft Platinum page background (~55%)
        surface: '#FFFFFF',          // White content surfaces (~25%)
        'text-primary': '#302A26',    // Primary body text
        'text-secondary': '#716963',  // Secondary text
        'border-subtle': '#DDD9D3',  // Subtle borders

        // Mocha Brown Brand Accent (~12%)
        mocha: {
          50: '#FAF7F5',
          100: '#F5EFEB',
          200: '#E8DDD5',
          300: '#D5C4B7',
          400: '#B49681',
          500: '#8F6B50',
          600: '#6F4E37', // Exact Mocha Brown Brand Primary
          700: '#5A3E2B',
          800: '#463022',
          900: '#302A26', // Mapped to primary neutral text for dark elements
          950: '#1E130D',
        },
        // Platinum Silver Spectrum
        platinum: {
          50: '#F4F3F1',  // Soft Platinum page background
          100: '#ECE9E5',
          200: '#E5E4E2', // Exact Platinum Silver
          300: '#DDD9D3', // Subtle structural borders
          400: '#BAB6B1',
          500: '#948F89',
          600: '#716963', // Secondary body text
          700: '#4D4641',
          800: '#302A26', // Primary body text
          900: '#1F1A17',
        },
        // Pale Lavender Accents (~8%)
        lavender: {
          50: '#FAF8FE',
          100: '#F3EFFC',
          200: '#E6E0F8', // Exact Pale Lavender Highlight
          300: '#D5C9F3',
          400: '#BCA8EC',
          500: '#9E83E2',
          700: '#5B418E',
          800: '#3D2D68',
          900: '#2A1F45',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(48, 42, 38, 0.04)',
        'card': '0 1px 3px 0 rgba(48, 42, 38, 0.06), 0 1px 2px -1px rgba(48, 42, 38, 0.04)',
        'elevated': '0 10px 25px -5px rgba(48, 42, 38, 0.08), 0 8px 10px -6px rgba(48, 42, 38, 0.04)',
        'glow-lavender': '0 0 0 3px rgba(230, 224, 248, 0.65)',
        'glow-mocha': '0 0 0 3px rgba(111, 78, 55, 0.2)',
      },
    },
  },
  plugins: [],
}
