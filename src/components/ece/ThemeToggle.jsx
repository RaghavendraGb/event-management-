import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/useTheme';

export function ThemeToggle({ className = '' }) {
  const [theme, toggleTheme] = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
        transition-all duration-200
        ${theme === 'dark'
          ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
        }
        ${className}
      `}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="text-xs">{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
