import { useCallback, useRef, useState } from 'react';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import { z } from 'zod';
import supabase from '@/lib/supabase';

interface UseAgentReturn {
  isActive: boolean;
  isConnected: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  error: string | null;
  muteSession: () => void;
  unmuteSession: () => void;
  isMuted: boolean;
}

// Define the interface for accessing piano functions
interface PianoControls {
  playNote: (note: number, velocity?: number) => void;
  stopNote: (note: number) => void;
  initializeAudio: () => Promise<void>;
}

export function useAgent(pianoControls: PianoControls): UseAgentReturn {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());

  // Helper function to convert note names to MIDI numbers
  const noteNameToMidi = useCallback((noteName: string): number => {
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
      'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) throw new Error(`Invalid note name: ${noteName}`);
    
    const [, note, octave] = match;
    const noteNumber = noteMap[note];
    if (noteNumber === undefined) throw new Error(`Invalid note: ${note}`);
    
    return (parseInt(octave) + 1) * 12 + noteNumber;
  }, []);

  // Tool for playing a single note
  const playNoteParameters = z.object({
    note: z.string().describe("Note name with octave (e.g., 'C4', 'F#3', 'Bb5')"),
    velocity: z.number().min(1).max(127).default(100).describe("Note velocity (1-127)"),
    duration: z.number().min(0.1).max(10).default(1).describe("Duration in seconds")
  });

  const playNoteTool = tool({
    name: 'play_note',
    description: 'Play a single piano note with specified velocity and duration',
    parameters: playNoteParameters,
    execute: async ({ note, velocity, duration }: z.infer<typeof playNoteParameters>) => {
      try {
        const midiNote = noteNameToMidi(note);
        
        // Initialize audio if needed
        await pianoControls.initializeAudio();
        
        // Play the note with visual feedback
        pianoControls.playNote(midiNote, velocity);
        activeNotesRef.current.add(midiNote);
        
        // Trigger visual animation
        if (typeof window !== 'undefined' && window.animatePianoKey) {
          window.animatePianoKey(midiNote, true);
        }
        
        // Stop the note after duration
        setTimeout(() => {
          pianoControls.stopNote(midiNote);
          activeNotesRef.current.delete(midiNote);
          
          // Stop visual animation
          if (typeof window !== 'undefined' && window.animatePianoKey) {
            window.animatePianoKey(midiNote, false);
          }
        }, duration * 1000);
        
        return `Played ${note} with velocity ${velocity} for ${duration} seconds`;
      } catch (error) {
        return `Error playing note: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  });

  // Tool for playing multiple notes (chords)
  const playChordParameters = z.object({
    notes: z.array(z.string()).describe("Array of note names with octaves (e.g., ['C4', 'E4', 'G4'])"),
    velocity: z.number().min(1).max(127).default(100).describe("Velocity for all notes (1-127)"),
    duration: z.number().min(0.1).max(10).default(2).describe("Duration in seconds")
  });

  const playChordTool = tool({
    name: 'play_chord',
    description: 'Play multiple piano notes simultaneously to form a chord',
    parameters: playChordParameters,
    execute: async ({ notes, velocity, duration }: z.infer<typeof playChordParameters>) => {
      try {
        // Initialize audio if needed
        await pianoControls.initializeAudio();
        
        const midiNotes = notes.map((note: string) => noteNameToMidi(note));
        
        // Play all notes with visual feedback
        midiNotes.forEach((midiNote: number) => {
          pianoControls.playNote(midiNote, velocity);
          activeNotesRef.current.add(midiNote);
          
          // Trigger visual animation
          if (typeof window !== 'undefined' && window.animatePianoKey) {
            window.animatePianoKey(midiNote, true);
          }
        });
        
        // Stop all notes after duration
        setTimeout(() => {
          midiNotes.forEach((midiNote: number) => {
            pianoControls.stopNote(midiNote);
            activeNotesRef.current.delete(midiNote);
            
            // Stop visual animation
            if (typeof window !== 'undefined' && window.animatePianoKey) {
              window.animatePianoKey(midiNote, false);
            }
          });
        }, duration * 1000);
        
        return `Played chord [${notes.join(', ')}] with velocity ${velocity} for ${duration} seconds`;
      } catch (error) {
        return `Error playing chord: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  });

  // Tool for playing a sequence of chords or notes
  const playSequenceParameters = z.object({
    sequence: z.array(z.object({
      notes: z.array(z.string()).describe("Note names for this step"),
      velocity: z.number().min(1).max(127).default(100),
      duration: z.number().min(0.1).max(10).default(1),
      delay: z.number().min(0).max(5).default(0).describe("Delay before playing this step")
    })).describe("Sequence of chords/notes to play"),
  });

  const playSequenceTool = tool({
    name: 'play_sequence',
    description: 'Play a sequence of chords or notes with specified timing',
    parameters: playSequenceParameters,
    execute: async ({ sequence }: z.infer<typeof playSequenceParameters>) => {
      try {
        await pianoControls.initializeAudio();
        
        let totalTime = 0;
        const result: string[] = [];
        
        sequence.forEach((step, index: number) => {
          setTimeout(() => {
            const midiNotes = step.notes.map((note: string) => noteNameToMidi(note));
            
            // Play all notes in this step with visual feedback
            midiNotes.forEach((midiNote: number) => {
              pianoControls.playNote(midiNote, step.velocity);
              activeNotesRef.current.add(midiNote);
              
              // Trigger visual animation
              if (typeof window !== 'undefined' && window.animatePianoKey) {
                window.animatePianoKey(midiNote, true);
              }
            });
            
            // Stop notes after duration
            setTimeout(() => {
              midiNotes.forEach((midiNote: number) => {
                pianoControls.stopNote(midiNote);
                activeNotesRef.current.delete(midiNote);
                
                // Stop visual animation
                if (typeof window !== 'undefined' && window.animatePianoKey) {
                  window.animatePianoKey(midiNote, false);
                }
              });
            }, step.duration * 1000);
            
          }, totalTime + step.delay * 1000);
          
          totalTime += (step.delay + step.duration) * 1000;
          result.push(`Step ${index + 1}: [${step.notes.join(', ')}]`);
        });
        
        return `Playing sequence: ${result.join(' -> ')}`;
      } catch (error) {
        return `Error playing sequence: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  });

  // Tool to stop all currently playing notes
  const stopAllNotesTool = tool({
    name: 'stop_all_notes',
    description: 'Stop all currently playing piano notes',
    parameters: z.object({}),
    execute: async () => {
      try {
        // Stop all active notes and animations
        activeNotesRef.current.forEach((midiNote: number) => {
          pianoControls.stopNote(midiNote);
        });
        activeNotesRef.current.clear();
        
        // Stop all visual animations
        if (typeof window !== 'undefined' && window.stopAllPianoAnimations) {
          window.stopAllPianoAnimations();
        }
        
        return 'Stopped all playing notes';
      } catch (error) {
        return `Error stopping notes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  });

  const startSession = useCallback(async () => {
    try {
      setError(null);
      
      // Check for API key

      const { data, error } = await supabase.functions.invoke('cora/session', {
        method: 'GET'
      })
      if (error) {
        throw new Error('Failed to get API key');
      }

      console.log(data)

      const apiKey = data?.client_secret?.value
      const model = data?.model
      const voice = data?.voice
      const instructions = data?.instructions
      const turnDetection = data?.turn_detection


      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set VITE_OPENAI_KEY.');
      }

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error('Microphone access denied. Please allow microphone access to use Cora.');
      }

      // Create the agent
      const agent = new RealtimeAgent({
        name: 'Cora',
        instructions,
        tools: [playNoteTool, playChordTool, playSequenceTool, stopAllNotesTool],
        
      });

      // Create session with proper configuration based on docs
      const session = new RealtimeSession(agent, {
        model,
        config: {
          turnDetection,
          voice
        }
      });



      // Connect to OpenAI first, then set up event listeners
      await session.connect({ apiKey });
      sessionRef.current = session;
      setIsActive(true);
      setIsConnected(true);
      
      // Set up event listeners after connection
      session.on('audio_interrupted', () => {
        console.log('Audio interrupted');
      });

      session.on('history_updated', (history) => {
        console.log('History updated:', history.length, 'items');
      });
      
      // Send initial greeting
      session.sendMessage("Hello! I'm Cora, your piano teacher. What would you like to learn about music today?");
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Cora';
      setError(errorMessage);
      console.error('Failed to start agent session:', err);
      setIsActive(false);
      setIsConnected(false);
    }
  }, [pianoControls, playNoteTool, playChordTool, playSequenceTool, stopAllNotesTool, noteNameToMidi]);

  const muteSession = useCallback(() => {
    if (sessionRef.current && !isMuted) {
      try {
        // Mute the session audio output
        sessionRef.current.mute(true);
        setIsMuted(true);
      } catch (error) {
        console.error('Error muting session:', error);
      }
    }
  }, [isMuted]);

  const unmuteSession = useCallback(() => {
    if (sessionRef.current && isMuted) {
      try {
        // Unmute the session audio output
        sessionRef.current.mute(false);
        setIsMuted(false);
      } catch (error) {
        console.error('Error unmuting session:', error);
      }
    }
  }, [isMuted]);

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      // Stop any playing notes and animations
      activeNotesRef.current.forEach((midiNote: number) => {
        pianoControls.stopNote(midiNote);
      });
      activeNotesRef.current.clear();
      
      // Stop all visual animations
      if (typeof window !== 'undefined' && window.stopAllPianoAnimations) {
        window.stopAllPianoAnimations();
      }
      
      // Disconnect session - based on docs, this should be available
      try {
        // The session should handle disconnection automatically when the component unmounts
        // or we can call session.interrupt() to stop current generation
        sessionRef.current.close();
      } catch (error) {
        console.error('Error interrupting session:', error);
      }
      sessionRef.current = null;
    }
    
    setIsActive(false);
    setIsConnected(false);
    setError(null);
    setIsMuted(false);
  }, [pianoControls]);

  return {
    isActive,
    isConnected,
    startSession,
    stopSession,
    error,
    muteSession,
    unmuteSession,
    isMuted
  };
}
