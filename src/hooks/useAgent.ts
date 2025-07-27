import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import supabase from '@/lib/supabase';
import { useConversation } from '@elevenlabs/react';
import { Chord, Note } from "tonal";

const DEFAULT_OCTAVE = 4;
const BASS_OCTAVE = 3;
const LOW_BASS_OCTAVE = 2;


interface UseAgentReturn {
  isActive: boolean;
  isConnected: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  error: string | null;
  muteSession: () => void;
  unmuteSession: () => void;
  isMuted: boolean;
  playChordsTool: (params: { chords: string[]; velocity?: number; duration?: number }) => Promise<string>;
  lessons: {title: string, markdown: string}[];
}

// Define the interface for accessing piano functions
interface PianoControls {
  playNote: (note: number, velocity?: number) => void;
  stopNote: (note: number) => void;
  initializeAudio: () => Promise<void>;
}


const getHumanizedDuration = (base: number) => {
  const variation = (Math.random() - 0.5) * 0.1; 
  const final = base + variation;
  return Math.max(0.5, parseFloat(final.toFixed(2)));
};

const getHumanOffset = () => Math.random() * 50; // ms
const getHumanVelocity = (velocity: number) => {
  return Math.max(1, Math.min(127, velocity + Math.round((Math.random() - 0.5) * 20)));
}

// Tool for playing multiple notes (chords)



const playChordParameters = z.object({
  notes: z.array(z.string()).describe("Array of note names with octaves (e.g., ['C4', 'E4', 'G4'])"),
  velocity: z.number().min(1).max(127).default(100).describe("Velocity for all notes (1-127)"),
  duration: z.number().min(0.1).max(10).default(2).describe("Duration in seconds"),
  arp: z.boolean().default(false).describe("Whether to arpeggiate the notes")
});

export function useAgent(pianoControls: PianoControls): UseAgentReturn {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [lessons, setLessons] = useState<{title: string, markdown: string}[]>([]);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const conversation = useConversation();

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


  const playChordTool = async ({
    notes,
    velocity = 100,
    duration = 2,
    arp = false,
  }: z.infer<typeof playChordParameters>) => {
    try {

      //validate parameters
      const validated = playChordParameters.safeParse({ notes, velocity, duration, arp });
      if (!validated.success) {
        throw new Error(validated.error.message);
      }

      await pianoControls.initializeAudio();
      const midiNotes = notes.map((note: string) => noteNameToMidi(note));
      if (arp) {
        // Arpeggiate notes: play one-by-one over duration
        const stepDurationMs = (duration * 1000) / midiNotes.length;
  
        midiNotes.forEach((midiNote, i) => {
          const v = getHumanVelocity(velocity);
          const playTime = i * stepDurationMs;
  
          setTimeout(() => {
            pianoControls.playNote(midiNote, v);
            activeNotesRef.current.add(midiNote);
  
            if (typeof window !== "undefined" && window.animatePianoKey) {
              window.animatePianoKey(midiNote, true);
            }
  
            // Stop note after fixed duration
            setTimeout(() => {
              pianoControls.stopNote(midiNote);
              activeNotesRef.current.delete(midiNote);
              if (typeof window !== "undefined" && window.animatePianoKey) {
                window.animatePianoKey(midiNote, false);
              }
            }, stepDurationMs);
          }, playTime);
        });
  
        // Wait for total duration before continuing
        await new Promise((resolve) => setTimeout(resolve, duration * 1000 + 60));
      } else {
        // Simultaneous chord with humanized onset
        midiNotes.forEach((midiNote) => {
          const offset = getHumanOffset();
          const v = getHumanVelocity(velocity);
  
          setTimeout(() => {
            pianoControls.playNote(midiNote, v);
            activeNotesRef.current.add(midiNote);
  
            if (typeof window !== "undefined" && window.animatePianoKey) {
              window.animatePianoKey(midiNote, true);
            }
  
            setTimeout(() => {
              pianoControls.stopNote(midiNote);
              activeNotesRef.current.delete(midiNote);
              if (typeof window !== "undefined" && window.animatePianoKey) {
                window.animatePianoKey(midiNote, false);
              }
            }, duration * 1000);
          }, offset);
        });
  
        await new Promise((resolve) => setTimeout(resolve, duration * 1000 + 60));
      }
  
      return `Played chord [${notes.join(", ")}] ${arp ? "as arpeggio" : "humanized"} for ${duration}s`;
    } catch (error) {
      return `Error playing chord: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  };
  
  


  const playChordsTool = async ({
    chords,
    velocity = 100,
    duration = 2,
    options = {},
  }: {
    chords: string[];
    velocity?: number;
    duration?: number;
    options?: {
      bass?: boolean;
      lowBass?: boolean;
      arp?: boolean;
    };
  }) => {
    try {

      const bass = options.bass || true;
      const lowBass = options.lowBass || true;
      const arp = options.arp || true;

      if (!chords?.length) throw new Error("No chords provided");
  
      for (const chordSymbol of chords) {
        const chordData = Chord.get(chordSymbol);
        if (!chordData?.notes?.length || !chordData.tonic) throw new Error(`Invalid chord: ${chordSymbol}`);
  
        // Get main chord voicing at DEFAULT_OCTAVE
        const rootWithOctave = chordData.tonic + DEFAULT_OCTAVE;
        const notesWithOctave = chordData.intervals.map((interval) =>
          Note.transpose(rootWithOctave, interval)
        );
  
        // Collect notes to play
        const finalNotes: string[] = [...notesWithOctave];
        const bassNote = chordData.bass || chordData.tonic;
  
        // Add bass note at DEFAULT_OCTAVE if requested
        if (bass && bassNote) {
          finalNotes.unshift(bassNote + BASS_OCTAVE);
        }
  
        // Add bass note at lower octave if requested
        if (lowBass && bassNote) {
          finalNotes.unshift(bassNote + LOW_BASS_OCTAVE);
        }
  
        await playChordTool({
          notes: finalNotes,
          velocity,
          duration: arp ? duration : getHumanizedDuration(duration),
          arp
        });
  
      }
  
      return `Played ${chords.length} chord(s) in sequence`;
    } catch (err) {
      return `Error in playChordsTool: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  };

  const stopAllNotesTool =  async () => {
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

  const makeLessonTool = async ({title, markdown}: {title: string, markdown: string}) => {
    try {
      setLessons([...lessons, {title, markdown}]);
      return `Lesson with title: ${title} created & being displayed to the user`;
    } catch (error) {
      return `Error making lesson: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }


  const startSession = useCallback(async () => {
    try {
      setError(null);
      
      // Check for API key

      const { data, error } = await supabase.functions.invoke('cora/conversation-token', {
        method: 'GET'
      })
      if (error) {
        throw new Error('Failed to get API key');
      }

      console.log(data)
      const conversationToken = data


      if (!conversationToken) {
        throw new Error('Failed to obtain conversation token');
      }

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error('Microphone access denied. Please allow microphone access to use Cora.');
      }

      await conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        clientTools: { playChordsTool, stopAllNotesTool, makeLessonTool }
      });


      setIsActive(true);
      setIsConnected(true);
      

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Cora';
      setError(errorMessage);
      console.error('Failed to start agent session:', err);
      setIsActive(false);
      setIsConnected(false);
    }
  }, [conversation]);

  const muteSession = useCallback(() => {
    if (conversation.status === 'connected') {
      conversation.micMuted = true
      setIsMuted(true)
    }
  }, [conversation]);

  const unmuteSession = useCallback(() => {
    if (conversation.status === 'connected') {
      conversation.micMuted = false
      setIsMuted(false)
    }
  }, [conversation]);

  const stopSession = useCallback(() => {
      // Stop any playing notes and animations
      activeNotesRef.current.forEach((midiNote: number) => {
        pianoControls.stopNote(midiNote);
      });
      activeNotesRef.current.clear();
      
      // Stop all visual animations
      if (typeof window !== 'undefined' && window.stopAllPianoAnimations) {
        window.stopAllPianoAnimations();
      }

      conversation.endSession()

    
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
    isMuted,
    playChordsTool,
    lessons
  };
}
