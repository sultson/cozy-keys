
import './App.css'
import { useState, useEffect } from 'react';
import { useSound } from './hooks/useSound';
import { useRecording } from './hooks/useRecording';
import { Piano } from './components/Piano';
import { RecordingsList } from './components/RecordingsList';
import { PresetSelect } from './components/PresetSelect';
import { Button } from '@/components/ui/button';
import { Mic, CheckCircle, AlertCircle, PianoIcon, Settings2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import { ModeToggle } from './components/mode-toggle';
import { Environments, type Environment } from './components/Environments';
import { CountdownOverlay } from './components/CountdownOverlay';
import { Slider } from './components/ui/slider';
import useAuth from './hooks/useAuth';


function App() {
  const [midiStatus, setMidiStatus] = useState('Waiting for MIDI...');
  const [midiConnected, setMidiConnected] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { 
    playNote, 
    stopNote, 
    isReady: soundReady, 
    initializeAudio,
    currentPreset,
    setPreset,
    availablePresets,
    setEnvironment,
    currentEnvironment,
    releaseTime,
    setReleaseTime
  } = useSound();
  const { 
    isRecording, 
    recordings, 
    cloudRecordings,
    isLoading,
    startRecording, 
    stopRecording, 
    recordEvent, 
    stopPlayback,
    uploadToCloud,
    refreshCloudRecordings,
    deleteLocalRecording,
    heartRecording,
    unheartRecording
  } = useRecording();

  

  const handleMidiStatusChange = (status: string, connected: boolean) => {
    setMidiStatus(status);
    setMidiConnected(connected);
  };

  const handleNoteOn = async (note: number, velocity: number) => {
    // Initialize audio on first note if not ready
    if (!soundReady) {
      await initializeAudio();
    }
    console.log(`App: handleNoteOn called with note=${note}, velocity=${velocity}, isRecording=${isRecording}`);
    recordEvent('on', note, velocity);
  };

  const handleStartSound = async () => {
    if (!soundReady) {
      await initializeAudio();
    }
    setIsSoundOn(true);
  };

  useEffect(() => {
    const handleStartSoundEvent = () => {
      handleStartSound();
    };

    window.addEventListener('startSound', handleStartSoundEvent);
    return () => {
      window.removeEventListener('startSound', handleStartSoundEvent);
    };
  }, [soundReady, initializeAudio]);

  const handleNoteOff = (note: number) => {
    console.log(`App: handleNoteOff called with note=${note}, isRecording=${isRecording}`);
    recordEvent('off', note, 0);
  };

  const handleEnvironmentChange = (environment: Environment) => {
    console.log('App: handleEnvironmentChange called with:', environment);
    setEnvironment(environment.id as 'quiet' | 'nature' | 'cosmic');
    console.log('App: Environment changed to:', environment.name);
  };

  const handleCountdownComplete = async () => {
    setShowCountdown(false);
    // Initialize audio when starting to record
    if (!soundReady) {
      await initializeAudio();
    }
    startRecording();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      stopPlayback(); // stop any playback
      setShowCountdown(true); // Start countdown
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col h-screen overflow-none">
        <CountdownOverlay 
          isVisible={showCountdown} 
          onCountdownComplete={handleCountdownComplete} 
        />
      {/* Header Bar */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur p-4">
        <div className="mx-auto flex items-center justify-between px-6 pt-3 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground ml-2"><PianoIcon className="w-4 h-4" /></span>
            <span className="font-bold text-xl tracking-tight text-primary">Cozy Keys</span>
          </div>
          
          <div className="fixed right-1/2">
            <Environments onEnvironmentChange={handleEnvironmentChange} />
          </div>

          <div className="flex items-center gap-2">
              {/* MIDI and Audio Status */}
              <div className="flex items-center gap-2 pr-2">
                {midiConnected ? (
                  <CheckCircle className="w-4 h-4 text-green-400" aria-label="MIDI Connected" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-400" aria-label="MIDI Not Connected" />
                )}
                <span className="text-xs text-muted-foreground">{midiStatus}</span>
              </div>
              
              
              <PresetSelect 
                currentPreset={currentPreset}
                onPresetChange={setPreset}
                availablePresets={availablePresets}
              />
              <ModeToggle />
              <Button 
                size="icon"
                variant={showSettings ? "default" : "outline"}
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="w-5 h-5" />
              </Button>
              <Button 
                size="icon"
                variant={isRecording ? "destructive" : "default"}
                onClick={toggleRecording}
                className={`rounded-full ${isRecording ? 'animate-pulse' : ''} ml-4`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
                
              >
                <Mic className="w-5 h-5" />
              </Button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative">
      <Piano 
        playNote={playNote}
        stopNote={stopNote}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
        onMidiStatusChange={handleMidiStatusChange}
        isSoundOn={isSoundOn}
        environment={currentEnvironment}
      />


      <div className={`absolute bottom-0 left-0 right-0 p-32 bg-background/80 backdrop-blur ${showSettings ? 'block' : 'hidden'} flex flex-col items-start justify-center h-full gap-4`}> 
        <p>Release (unstable) {releaseTime / 1000}s</p>
            <Slider 
              min={0}
              max={5000}
              step={100}
              value={[releaseTime]}
              onValueChange={(value) => setReleaseTime(value[0])}
              
            />
            </div>
      </div>
        <ErrorBoundary>
        <RecordingsList 
          recordings={recordings}
          cloudRecordings={cloudRecordings}
          onStopPlayback={stopPlayback}
          isSoundOn={isSoundOn}
          onUploadToCloud={uploadToCloud}
          onDeleteCloudRecording={async (id) => {
            // Import the delete function and use it
            const { deleteRecording } = await import('./lib/api');
            const success = await deleteRecording(id);
            if (success) {
              await refreshCloudRecordings();
            }
            return success;
          }}
          onHeartRecording={heartRecording}
          onUnheartRecording={unheartRecording}
          userId={userId}
          isLoading={isLoading}
          onDeleteLocalRecording={deleteLocalRecording}
        />
      </ErrorBoundary>
      </div>
    </ThemeProvider>
  )
}

export default App
