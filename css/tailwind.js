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
    tailwind.config = { /* your config */ };
    
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
document.head.appendChild(tailwindScript);
