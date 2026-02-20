// Suppress warning (same as before)
if (window.console && console.warn) {
    const originalWarn = console.warn;
    console.warn = function(...args) {
        if (args[0] && args[0].includes('cdn.tailwindcss.com should not be used in production')) {
            return;
        }
        originalWarn.apply(console, args);
    };
}

// Load Tailwind
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
tailwindScript.onload = function() {
    // ✅ FIXED: Replace the placeholder comment with actual config
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
    
    const customStyles = document.createElement('link');
    customStyles.rel = 'stylesheet';
    customStyles.href = 'css/styles.css';
    customStyles.onload = function() {
        // Show content and remove loading
        document.documentElement.style.visibility = 'visible';
        const loader = document.querySelector('.loading-spinner');
        if (loader) loader.remove();
    };
    document.head.appendChild(customStyles);
};

// Add error handling in case Tailwind fails to load
tailwindScript.onerror = function() {
    console.error('Failed to load Tailwind CSS');
    // Show content even if Tailwind fails to load
    document.documentElement.style.visibility = 'visible';
    const loader = document.querySelector('.loading-spinner');
    if (loader) loader.remove();
};

document.head.appendChild(tailwindScript);
