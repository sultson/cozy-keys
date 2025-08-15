import { grandPiano } from '@/utils/grandPiano';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';

export type SoundPreset = 'juno' | 'grand-piano' | 'kalimba' | 'moog' | 'ob-xa-brass' | 'organ';

export type Environment = 'quiet' | 'nature' | 'cosmic';

interface UseSoundReturn {
  playNote: (note: number, velocity?: number) => void;
  stopNote: (note: number) => void;
  isReady: boolean;
  initializeAudio: (envOverride?: Environment) => Promise<void>;
  currentPreset: SoundPreset;
  setPreset: (preset: SoundPreset) => void;
  availablePresets: SoundPreset[];
  setEnvironment: (environment: Environment) => void;
  currentEnvironment: Environment;
  releaseTime: number;
  setReleaseTime: (time: number) => void;
}

// Accept both PolySynth and Sampler
export type SynthType = Tone.PolySynth<Tone.Synth> | Tone.Sampler;

// Type for preset objects that may include chorus and volume
interface PresetObject {
  synth: SynthType;
  chorus?: Tone.Chorus;
  volume?: Tone.Volume;
}

export function useSound(): UseSoundReturn {
  const synthRef = useRef<SynthType | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const globalReverbRef = useRef<Tone.Reverb | null>(null);
  const globalDelayRef = useRef<Tone.FeedbackDelay | null>(null);
  const masterVolumeRef = useRef<Tone.Volume | null>(null);
  const presetVolumeRef = useRef<Tone.Volume | null>(null);
  const isReadyRef = useRef(false);
  const isInitializedRef = useRef(false);
  const [currentPreset, setCurrentPreset] = useState<SoundPreset>('grand-piano');
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment>('quiet');


  const initialReleaseTime = 0;
  const [releaseTime, _setReleaseTime] = useState(initialReleaseTime);
  const releaseTimeRef = useRef(initialReleaseTime);
  const setReleaseTime = useCallback((time: number) => { 
    releaseTimeRef.current = time;
    _setReleaseTime(time);
  }, [releaseTimeRef]);




  const availablePresets: SoundPreset[] = ['juno', 'grand-piano', 'organ','kalimba', 'moog', 'ob-xa-brass'];

  // Environment-based reverb and delay settings
  const getEnvironmentReverbSettings = useCallback((environment: Environment) => {
    switch (environment) {
      case 'quiet': // Studio
        return { decay: 0.5, preDelay: 0.01, wet: 0.1, delayTime: 0, delayWet: 0 };
      case 'nature': // Forest
        return { decay: 2.0, preDelay: 0.05, wet: 0.3, delayTime: 0.4, delayWet: 0.05 };
      case 'cosmic': // Cosmic
        return { decay: 8.0, preDelay: 0.1, wet: 0.7, delayTime: 0.6, delayWet: 0.3 };
      default:
        return { decay: 0.5, preDelay: 0.01, wet: 0.1, delayTime: 0, delayWet: 0 };
    }
  }, []);

  const createGrandPianoPreset = useCallback(() => {
    // Only synth is returned for grand-piano
    return grandPiano();
  }, []);
 
  const createJunoPreset = useCallback(() => {
    // Create a Juno-style PolySynth with warm, lush sound
    const chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      feedback: 0.2,
      spread: 180,
      wet: 0.5
    }).start();

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'fatsawtooth', // Fat sawtooth for warmth
        count: 3,            // Multiple detuned oscillators
        spread: 20           // Detune amount
      },
      envelope: {
        attack: 0.02,
        decay: 0.15,
        sustain: 0.6,
        release: 0.8
      }
    });
    
    // Set polyphony
    synth.maxPolyphony = 64;
    
    // Connect synth to chorus (but not to destination - global reverb will handle that)
    synth.connect(chorus);

    return { synth, chorus };
  }, []);

  const createKalimbaPreset = useCallback(() => {
    // Create a Kalimba-style sound with metallic, bell-like tones
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle' // Triangle wave for softer, bell-like sound
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 1.2
      }
    });
    
    // Set polyphony
    synth.maxPolyphony = 32;
    
    return { synth };
  }, []);

  const createMoogPreset = useCallback(() => {
    // Create a Moog-style analog synth with warm, fat sound
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sawtooth' // Classic Moog sawtooth
      },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.7,
        release: 0.5
      }
    });
    
    // Set polyphony
    synth.maxPolyphony = 16;
    
    return { synth };
  }, []);

  
  const createOBXaBrassPreset = useCallback(() => {
    // Create an OB-Xa style brass pad with rich, warm character
    const chorus = new Tone.Chorus({
      frequency: 2.0,
      delayTime: 2.5,
      depth: 0.6,
      feedback: 0.3,
      spread: 90,
      wet: 0.4
    }).start();

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'square' // Square wave for brass character
      },
      envelope: {
        attack: 0.3,
        decay: 0.4,
        sustain: 0.8,
        release: 1.5
      }
    });
    
    // Set polyphony
    synth.maxPolyphony = 8;
    
    // Connect synth to chorus
    synth.connect(chorus);

    return { synth, chorus };
  }, []);

  const createOrganPreset = useCallback(() => {
    // Create a Hammond-style organ with proper drawbar harmonics
    const chorus = new Tone.Chorus({
      frequency: 3.0,
      delayTime: 2.0,
      depth: 0.8,
      feedback: 0.1,
      spread: 180,
      wet: 0.6
    }).start();


    // Create multiple oscillators for Hammond drawbar effect
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'fatsine4', // Multiple sine waves with 8 harmonics
        spread:20,        // Detune oscillators by 25 cents for richness
        count: 2          // Use 3 detuned oscillators per note
      },
      envelope: {
        attack: 0.01,  // Very quick attack like real organ
        decay: 0.05,
        sustain: 0.95, // High sustain
        release: 0.3   // Quick release
      }
    });
    
    // Set polyphony for rich chords
    synth.maxPolyphony = 32;
    
    // Connect synth through distortion to chorus for authentic Hammond sound
    synth.connect(chorus);

    return { synth, chorus };
  }, []);

  

  const createPreset = useCallback((preset: SoundPreset) => {
    switch (preset) {
      case 'juno':
        return createJunoPreset();
      case 'grand-piano':
        return createGrandPianoPreset();
      case 'kalimba':
        return createKalimbaPreset();
      case 'moog':
        return createMoogPreset();
      case 'ob-xa-brass':
        return createOBXaBrassPreset();
      case 'organ':
        return createOrganPreset();
      default:
        return createGrandPianoPreset();
    }
  }, [createGrandPianoPreset, createJunoPreset, createKalimbaPreset, createMoogPreset, createOBXaBrassPreset, createOrganPreset]);

  const initializeAudio = useCallback(async (envOverride?: Environment) => {
    if (isInitializedRef.current) return;
    const env = envOverride ?? currentEnvironment;
    try {
      // Start Tone.js context first (requires user gesture)
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      // Create global reverb and delay based on environment
      const reverbSettings = getEnvironmentReverbSettings(env);
      console.log('Initializing global effects with settings:', reverbSettings, 'for environment:', env);
      
      // Create a master volume control to prevent clipping
      masterVolumeRef.current = new Tone.Volume(-12).toDestination();
      
      // Create global delay
      globalDelayRef.current = new Tone.FeedbackDelay({
        delayTime: reverbSettings.delayTime,
        feedback: 0.3,
        wet: reverbSettings.delayWet
      });
      
      // Create global reverb
      globalReverbRef.current = new Tone.Reverb({
        decay: reverbSettings.decay,
        preDelay: reverbSettings.preDelay,
        wet: reverbSettings.wet
      });
      
      // Connect effects chain: delay -> reverb -> master volume
      globalDelayRef.current.connect(globalReverbRef.current);
      globalReverbRef.current.connect(masterVolumeRef.current);

      const presetObj = createPreset(currentPreset);
      synthRef.current = presetObj.synth;
      // Set chorus for presets that have it
      chorusRef.current = 'chorus' in presetObj ? (presetObj as PresetObject).chorus || null : null;
      // Set volume for presets that have it (like grand piano)
      presetVolumeRef.current = 'volume' in presetObj ? (presetObj as PresetObject).volume || null : null;
      reverbRef.current = null; // No preset-specific reverb anymore
      
      // Connect synth to global effects chain
      if (synthRef.current) {
        // For Juno preset, connect chorus to global delay
        if (chorusRef.current) {
          chorusRef.current.connect(globalDelayRef.current);
        } else {
          // For grand piano, connect volume to global delay
          if (presetVolumeRef.current) {
            presetVolumeRef.current.connect(globalDelayRef.current);
          } else {
            // For other presets, connect synth directly to global delay
            synthRef.current.connect(globalDelayRef.current);
          }
        }
      }
      
      isReadyRef.current = true;
      isInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }, [currentPreset, currentEnvironment, createPreset, getEnvironmentReverbSettings]);

  const setEnvironment = useCallback(async (environment: Environment) => {
    console.log('setEnvironment called with:', environment, 'current:', currentEnvironment);
    if (environment === currentEnvironment) return;

    setCurrentEnvironment(environment);

    // If already initialized, force reinitialization with new environment
    if (isInitializedRef.current) {
      try {
        console.log('Reinitializing audio with new environment:', environment);
        
        // Clean up current audio chain
        if (synthRef.current) {
          synthRef.current.dispose();
        }
        if (chorusRef.current) {
          chorusRef.current.dispose();
        }
        if (globalReverbRef.current) {
          globalReverbRef.current.dispose();
        }
        if (globalDelayRef.current) {
          globalDelayRef.current.dispose();
        }
        if (masterVolumeRef.current) {
          masterVolumeRef.current.dispose();
        }
        if (presetVolumeRef.current) {
          presetVolumeRef.current.dispose();
        }
        
        // Reset initialization flag to force reinitialization
        isInitializedRef.current = false;
        isReadyRef.current = false;
        
        // Reinitialize with new environment
        await initializeAudio(environment);
        console.log('Audio reinitialized with new environment');
      } catch (error) {
        console.error('Failed to reinitialize audio with new environment:', error);
      }
    } else {
      console.log('Audio not initialized yet, environment will be applied on first note');
    }
  }, [currentEnvironment, initializeAudio]);

  const setPreset = useCallback(async (preset: SoundPreset) => {
    if (preset === currentPreset) return;

    // Cleanup current preset
    if (synthRef.current) {
      synthRef.current.dispose();
    }
    if (chorusRef.current) {
      chorusRef.current.dispose();
    }
    if (reverbRef.current) {
      reverbRef.current.dispose();
    }
    if (presetVolumeRef.current) {
      presetVolumeRef.current.dispose();
    }

    setCurrentPreset(preset);

    // If already initialized, create new preset immediately
    if (isInitializedRef.current) {
      try {
        const presetObj = createPreset(preset);
        synthRef.current = presetObj.synth;
        chorusRef.current = 'chorus' in presetObj ? (presetObj as PresetObject).chorus || null : null;
        presetVolumeRef.current = 'volume' in presetObj ? (presetObj as PresetObject).volume || null : null;
        reverbRef.current = null; // No preset-specific reverb anymore
        
        // Reconnect to global effects chain
        if (synthRef.current && globalDelayRef.current) {
          // For Juno preset, connect chorus to global delay
          if (chorusRef.current) {
            chorusRef.current.connect(globalDelayRef.current);
          } else {
            // For grand piano, connect volume to global delay
            if (presetVolumeRef.current) {
              presetVolumeRef.current.connect(globalDelayRef.current);
            } else {
              // For other presets, connect synth directly to global delay
              synthRef.current.connect(globalDelayRef.current);
            }
          }
        }
      } catch (error) {
        console.error('Failed to switch preset:', error);
      }
    }
  }, [currentPreset, createPreset]);

  useEffect(() => {
    // Don't initialize audio automatically - wait for user interaction

    return () => {
      // Cleanup
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (chorusRef.current) {
        chorusRef.current.dispose();
      }
      if (reverbRef.current) {
        reverbRef.current.dispose();
      }
      if (globalReverbRef.current) {
        globalReverbRef.current.dispose();
      }
      if (globalDelayRef.current) {
        globalDelayRef.current.dispose();
      }
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
      }
      if (presetVolumeRef.current) {
        presetVolumeRef.current.dispose();
      }
    };
  }, []);

  // MIDI note number to frequency (not strictly needed for Tone.js, but useful for reference)
  const midiToNoteName = useCallback((midi: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = noteNames[midi % 12];
    return note + octave;
  }, []);

  const playNote = useCallback(async (note: number, velocity: number = 127) => {
    // Initialize audio on first use (requires user gesture)
    if (!isInitializedRef.current) {
      await initializeAudio();
    }

    if (!synthRef.current || !isReadyRef.current) return;

    try {
      const noteName = midiToNoteName(note);
      // Clamp velocity to 1-127, then scale 0-1
      const safeVelocity = Math.max(1, Math.min(127, velocity));
      const vel = Math.max(0.05, Math.min(1, safeVelocity / 127));
      console.log('Play note', noteName, vel);
      synthRef.current.triggerAttack(noteName, undefined, vel);
    } catch (error) {
      console.error('Failed to play note:', error);
    }
  }, [midiToNoteName, initializeAudio]);

  const stopNote = useCallback(async (note: number) => {
    if (!synthRef.current || !isReadyRef.current) return;

    try {
      const noteName = midiToNoteName(note);
      if (releaseTimeRef.current > 0) {
        await new Promise(resolve => setTimeout(resolve, releaseTimeRef.current));
      }

      synthRef.current.triggerRelease(noteName);
    } catch (error) {
      console.error('Failed to stop note:', error);
    }
  }, [midiToNoteName]);

  return {
    playNote,
    stopNote,
    isReady: isReadyRef.current,
    initializeAudio,
    currentPreset,
    setPreset,
    availablePresets,
    setEnvironment,
    currentEnvironment,
    releaseTime: releaseTime,
    setReleaseTime
  };
} 