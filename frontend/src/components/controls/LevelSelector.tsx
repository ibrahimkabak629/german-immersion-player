import { GERMAN_LEVELS, type GermanLevel } from '../../types/segment';
import { Dropdown, type DropdownOption } from '../ui/Dropdown';

const LEVEL_HINTS: Record<GermanLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Int.',
  C1: 'Advanced',
  C2: 'Mastery',
};

const options: DropdownOption<GermanLevel>[] = GERMAN_LEVELS.map((level) => ({
  value: level,
  label: level,
  hint: LEVEL_HINTS[level],
}));

interface LevelSelectorProps {
  level: GermanLevel;
  onChange: (level: GermanLevel) => void;
}

export function LevelSelector({ level, onChange }: LevelSelectorProps) {
  return <Dropdown value={level} options={options} onChange={onChange} triggerLabel="Level" />;
}
