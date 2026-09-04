import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { IconButton } from '../ui/IconButton';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
      {theme === 'dark' ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
    </IconButton>
  );
}
