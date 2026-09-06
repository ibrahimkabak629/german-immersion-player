import { SlidersHorizontal } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { Toggle } from '../ui/Toggle';
import { useSettings } from '../../context/SettingsContext';
import { SETTINGS_CATALOG } from '../../types/learning';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, setSetting } = useSettings();

  return (
    <Drawer open={open} onClose={onClose} title="Settings" icon={<SlidersHorizontal size={15} strokeWidth={1.75} className="text-fg-muted" />}>
      <div className="divide-y divide-border">
        {SETTINGS_CATALOG.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{item.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-fg-muted">{item.description}</p>
            </div>
            <Toggle checked={settings[item.key]} onChange={(value) => setSetting(item.key, value)} label={item.label} />
          </div>
        ))}
      </div>
      <p className="px-4 py-4 text-xs text-fg-muted">Preferences are saved on this device only.</p>
    </Drawer>
  );
}
