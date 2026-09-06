import { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_SETTINGS, type AppSettings } from '../types/learning';

interface SettingsContextValue {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setSettings] = useLocalStorage<AppSettings>('gip-settings', DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  const setSetting: SettingsContextValue['setSetting'] = (key, value) => {
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, [key]: value }));
  };

  return <SettingsContext.Provider value={{ settings, setSetting }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
