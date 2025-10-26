import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SoundPreset } from '@/hooks/useSound';

interface PresetSelectProps {
  currentPreset: SoundPreset;
  onPresetChange: (preset: SoundPreset) => void;
  availablePresets: SoundPreset[];
}

const presetLabels: Record<SoundPreset, string> = {
  'grand-piano': 'Grand Piano',
  'juno': 'Juno Synth',
  'organ': 'Hammond Organ',
  'kalimba': 'Kalimba',
  'moog': 'Moog',
  'ob-xa-brass': 'OB-Xa Brass',
};

export function PresetSelect({ currentPreset, onPresetChange, availablePresets }: PresetSelectProps) {
  return (
    <Select value={currentPreset} onValueChange={onPresetChange}>
      <SelectTrigger className="w-full md:w-[140px] max-w-[200px] md:max-w-none">
        <SelectValue placeholder="Select preset" />
      </SelectTrigger>
      <SelectContent>
        {availablePresets.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {presetLabels[preset]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 