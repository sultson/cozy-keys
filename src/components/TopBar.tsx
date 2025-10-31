import { Button } from '@/components/ui/button';
import { Mic, CheckCircle, AlertCircle, AlertTriangle, PianoIcon, Settings2 } from 'lucide-react';
import { PresetSelect } from './PresetSelect';
import { ModeToggle } from './mode-toggle';
import { Environments, type Environment } from './Environments';
import { type SoundPreset } from '../hooks/useSound';
import Cora from './Cora';

interface TopBarProps {
  midiConnected: boolean;
  midiStatus: string;
  currentPreset: SoundPreset;
  onPresetChange: (preset: SoundPreset) => void;
  availablePresets: SoundPreset[];
  showSettings: boolean;
  onSettingsToggle: () => void;
  isCoraActive: boolean;
  isCoraConnecting: boolean;
  onToggleCora: () => void;
  onToggleCoraMute: () => void;
  isCoraSessionMuted: boolean;
  coraError: string;
  isRecording: boolean;
  onToggleRecording: () => void;
  onEnvironmentChange: (environment: Environment) => void;
}

export function TopBar({
  midiConnected,
  midiStatus,
  currentPreset,
  onPresetChange,
  availablePresets,
  showSettings,
  onSettingsToggle,
  isCoraActive,
  isCoraConnecting,
  onToggleCora,
  onToggleCoraMute,
  isCoraSessionMuted,
  coraError,
  isRecording,
  onToggleRecording,
  onEnvironmentChange,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur p-2 md:p-4">
      <div className="mx-auto flex flex-col md:flex-row items-center justify-between px-2 md:px-6 pt-2 md:pt-3 gap-3 md:gap-4">
        {/* Logo and MIDI Status Row */}
        <div className="flex items-center justify-center md:justify-between w-full md:w-auto">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              <PianoIcon className="w-4 h-4" />
            </span>
            <span className="font-bold text-lg md:text-xl tracking-tight text-primary">Cozy Keys</span>
          </div>

          {/* MIDI Status - hidden on very small screens, shown on md+ */}
          <div className="hidden md:flex items-center gap-2 pr-2 ml-4 mt-0.5">
            {midiConnected ? (
              <CheckCircle className="w-4 h-4 text-green-400" aria-label="MIDI Connected" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400" aria-label="MIDI Not Connected" />
            )}
            <span className="text-xs text-muted-foreground">{midiStatus}</span>
          </div>
        </div>

        {/* Environments - centered for desktop, top row for mobile */}
        <div className="md:absolute right-1/2">
          <Environments onEnvironmentChange={onEnvironmentChange} />
        </div>

        {/* Controls - split into rows on mobile */}
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-2 w-full md:w-auto">
          {/* First row: Preset and Settings */}
          <div className="flex items-center justify-between md:justify-center gap-2 w-full md:w-auto px-2 md:px-0">
            <PresetSelect
              currentPreset={currentPreset}
              onPresetChange={onPresetChange}
              availablePresets={availablePresets}
            />
            <div className="flex items-center gap-2">
              <ModeToggle />
              {/* <Button
                size="icon"
                variant={showSettings ? "default" : "outline"}
                onClick={onSettingsToggle}
                className="h-9 w-9"
              >
                <Settings2 className="w-4 h-4" />
              </Button> */}
            </div>
          </div>

          {/* Second row: Cora and Recording */}
          <div className="flex items-center justify-between md:justify-center gap-5 w-full md:w-auto px-2 md:px-0">
            <Cora
              isCoraActive={isCoraActive}
              isCoraConnecting={isCoraConnecting}
              toggleCora={onToggleCora}
              toggleCoraMute={onToggleCoraMute}
              isCoraSessionMuted={isCoraSessionMuted}
              coraError={coraError}
            />
            <Button
              size="icon"
              variant={isRecording ? "destructive" : "default"}
              onClick={onToggleRecording}
              className={`rounded-full h-8 w-8 md:h-10 md:w-10 transition-all duration-200 hover:scale-105 active:scale-95 ${
                isRecording
                  ? 'animate-pulse shadow-lg shadow-red-500/50 dark:shadow-red-400/30 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-2 border-red-400 dark:border-red-500'
                  : 'shadow-xl shadow-black/30 dark:shadow-white/20 bg-gradient-to-br from-gray-600 to-gray-700 dark:from-gray-200 dark:to-gray-100 hover:from-gray-700 hover:to-gray-800 dark:hover:from-gray-100 dark:hover:to-gray-50 border-2 border-gray-700 dark:border-gray-300'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              <Mic className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${
                isRecording
                  ? 'text-white drop-shadow-sm'
                  : 'text-white dark:text-gray-900 drop-shadow-sm'
              }`} />
            </Button>
          </div>
        </div>

        {/* Status alerts for mobile */}
        <div className="flex md:hidden flex-col gap-1 mt-1">
          {/* MIDI Status for mobile */}
          <div className="flex items-center justify-center gap-2">
            {midiConnected ? (
              <CheckCircle className="w-4 h-4 text-green-400" aria-label="MIDI Connected" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400" aria-label="MIDI Not Connected" />
            )}
            <span className="text-xs text-muted-foreground">{midiStatus}</span>
          </div>

          {/* Mobile experience alert */}
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" aria-label="Mobile Experience Limited" />
            <span className="text-xs text-muted-foreground">Mobile experience is limited</span>
          </div>
        </div>
      </div>
    </header>
  );
}
