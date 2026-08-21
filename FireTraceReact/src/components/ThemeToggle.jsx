import { useTheme } from '../context/useTheme';

function ThemeToggle({ className = 'civ-icon-btn' }) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            className={className}
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
    );
}

export default ThemeToggle;
