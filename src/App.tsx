
import './App.css'
import { useState, useEffect } from 'react';
import { useSound } from './hooks/useSound';
import { useRecording } from './hooks/useRecording';
import { useAgent } from './hooks/useAgent';
import { Piano } from './components/Piano';
import { RecordingsList } from './components/RecordingsList';
import { PresetSelect } from './components/PresetSelect';
import { Button } from '@/components/ui/button';
import { Mic, CheckCircle, AlertCircle, PianoIcon, Settings2, Square, VolumeX, Volume2, Loader2, BookHeart} from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import { ModeToggle } from './components/mode-toggle';
import { Environments, type Environment } from './components/Environments';
import { CountdownOverlay } from './components/CountdownOverlay';
import useAuth from './hooks/useAuth';
import Settings from './Settings';
import Lessons from './components/Lessons';


function App() {
  const [midiStatus, setMidiStatus] = useState('Waiting for MIDI...');
  const [midiConnected, setMidiConnected] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCoraConnecting, setIsCoraConnecting] = useState(false);
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
  
  // Initialize voice agent with piano controls
  const { 
    isActive: isCoraActive, 
    isConnected: isCoraConnected, 
    startSession: startCoraSession, 
    stopSession: stopCoraSession, 
    error: coraError,
    muteSession: muteCoraSession,
    unmuteSession: unmuteCoraSession,
    isMuted: isCoraSessionMuted,
    playChordsTool,
    lessons
  } = useAgent({ playNote, stopNote, initializeAudio });
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

  // Handle Cora connection state changes
  useEffect(() => {
    if (isCoraConnected && isCoraConnecting) {
      setIsCoraConnecting(false);
    }
  }, [isCoraConnected, isCoraConnecting]);

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

  const toggleCora = async () => {
    if (isCoraActive) {
      stopCoraSession();
      setIsCoraConnecting(false);
    } else {
      setIsCoraConnecting(true);
      try {
        // Initialize audio first if needed
        if (!soundReady) {
          await initializeAudio();
        }
        await startCoraSession();
        // Connection state will be handled by the useAgent hook
      } catch (error) {
        console.error('Failed to start Cora:', error);
        setIsCoraConnecting(false);
      }
    }
  };

  const toggleCoraMute = () => {
    if (isCoraSessionMuted) {
      unmuteCoraSession();
    } else {
      muteCoraSession();
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
              
              {/* Learn with Cora Buttons */}
              {!isCoraActive && !isCoraConnecting && (
                <Button 
                  variant="secondary"
                  onClick={toggleCora}
                  className="transition-all duration-200
                    dark:bg-gradient-to-r dark:from-indigo-900 dark:via-slate-800 dark:to-indigo-950 dark:text-indigo-100 dark:border-indigo-600 dark:shadow-lg dark:shadow-indigo-900/30
                    bg-gradient-to-r from-indigo-100 via-slate-100 to-white text-indigo-900 border border-indigo-300 shadow-lg shadow-indigo-200/40
                    hover:from-indigo-200 hover:to-indigo-100 hover:text-indigo-800 hover:border-indigo-400
                    dark:hover:from-indigo-800 dark:hover:to-indigo-900 dark:hover:text-indigo-50 dark:hover:border-indigo-400
                    focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:outline-none
                    active:scale-100 active:shadow-md
                    hover:scale-105 hover:shadow-xl"
                  title={coraError || 'Learn with Cora'}
                >
                  <BookHeart className="w-4 h-4 mr-2 text-indigo-500 group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-indigo-100 transition-colors duration-200" />
                  <span className="font-semibold tracking-wide">Learn with Cora</span>
                </Button>
              )}
              
              {isCoraConnecting && (
                <Button 
                  size="default"
                  variant="secondary"
                  disabled
                  className="transition-all duration-200"
                  title="Connecting to Cora..."
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </Button>
              )}
              
              {isCoraActive && (
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon"
                    variant="destructive"
                    onClick={toggleCora}
                    className="transition-all duration-200"
                    title="Stop Learning with Cora"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="icon"
                    variant={isCoraSessionMuted ? "outline" : "secondary"}
                    onClick={toggleCoraMute}
                    className="transition-all duration-200"
                    title={isCoraSessionMuted ? "Unmute Cora" : "Mute Cora"}
                  >
                    {isCoraSessionMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>
              )}
              
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


        <Settings
          showSettings={showSettings}
          releaseTime={releaseTime}
          setReleaseTime={setReleaseTime}
          playChordsTool={playChordsTool}
        />
        </div>
  
        { isCoraActive && lessons && lessons.length > 0 && (
          <Lessons lessons={lessons} />
        )}
    
        <ErrorBoundary fallback={<div>Could not load recordings</div>}>
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
