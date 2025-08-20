// Suppress Tailwind CDN warning for Canvas apps
if (window.console && console.warn) {
    const originalWarn = console.warn;
    console.warn = function(...args) {
        if (args[0] && args[0].includes('cdn.tailwindcss.com should not be used in production')) {
            return; // Suppress this specific warning
        }
        originalWarn.apply(console, args);
    };
}

// Dynamically load Tailwind CSS
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
tailwindScript.onload = function() {
    // Configure Tailwind after it loads
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    primary: '#5D5CDE',
                    'primary-dark': '#4C4BC4',
                    'primary-light': '#7B7AE8'
                },
                animation: {
                    'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    'slide-in': 'slideIn 0.2s ease-out',
                    'slide-out': 'slideOut 0.2s ease-in'
                },
                keyframes: {
                    slideIn: {
                        '0%': { transform: 'translateX(-100%)', opacity: '0' },
                        '100%': { transform: 'translateX(0)', opacity: '1' }
                    },
                    slideOut: {
                        '0%': { transform: 'translateX(0)', opacity: '1' },
                        '100%': { transform: 'translateX(-100%)', opacity: '0' }
                    }
                }
            }
        }
    };
};
document.head.appendChild(tailwindScript);
