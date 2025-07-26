import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import supabase from '@/lib/supabase';
import { useConversation } from '@elevenlabs/react';


interface UseAgentReturn {
  isActive: boolean;
  isConnected: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  error: string | null;
  muteSession: () => void;
  unmuteSession: () => void;
  isMuted: boolean;
  playChordTool: (params: z.infer<typeof playChordParameters>) => Promise<string>;
}

// Define the interface for accessing piano functions
interface PianoControls {
  playNote: (note: number, velocity?: number) => void;
  stopNote: (note: number) => void;
  initializeAudio: () => Promise<void>;
}

// Tool for playing multiple notes (chords)
const playChordParameters = z.object({
  notes: z.array(z.string()).describe("Array of note names with octaves (e.g., ['C4', 'E4', 'G4'])"),
  velocity: z.number().min(1).max(127).default(100).describe("Velocity for all notes (1-127)"),
  duration: z.number().min(0.1).max(10).default(2).describe("Duration in seconds")
});

export function useAgent(pianoControls: PianoControls): UseAgentReturn {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
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



 

  console.log(playChordParameters)

  
  const playChordTool =  async ({notes, velocity = 100, duration = 2}: z.infer<typeof playChordParameters>) => {
      try {
        if (!notes || !velocity || !duration) {
          throw new Error('Missing required parameters');
        }

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


  // TODO: Reimplement for elevenlabs
    // Tool for playing a single note
  // const playNoteParameters = z.object({
  //   note: z.string().describe("Note name with octave (e.g., 'C4', 'F#3', 'Bb5')"),
  //   velocity: z.number().min(1).max(127).default(100).describe("Note velocity (1-127)"),
  //   duration: z.number().min(0.1).max(10).default(1).describe("Duration in seconds")
  // });

  // const playNoteTool = tool({
  //   name: 'play_note',
  //   description: 'Play a single piano note with specified velocity and duration',
  //   parameters: playNoteParameters,
  //   execute: async ({ note, velocity, duration }: z.infer<typeof playNoteParameters>) => {
  //     try {
  //       const midiNote = noteNameToMidi(note);
        
  //       // Initialize audio if needed
  //       await pianoControls.initializeAudio();
        
  //       // Play the note with visual feedback
  //       pianoControls.playNote(midiNote, velocity);
  //       activeNotesRef.current.add(midiNote);
        
  //       // Trigger visual animation
  //       if (typeof window !== 'undefined' && window.animatePianoKey) {
  //         window.animatePianoKey(midiNote, true);
  //       }
        
  //       // Stop the note after duration
  //       setTimeout(() => {
  //         pianoControls.stopNote(midiNote);
  //         activeNotesRef.current.delete(midiNote);
          
  //         // Stop visual animation
  //         if (typeof window !== 'undefined' && window.animatePianoKey) {
  //           window.animatePianoKey(midiNote, false);
  //         }
  //       }, duration * 1000);
        
  //       return `Played ${note} with velocity ${velocity} for ${duration} seconds`;
  //     } catch (error) {
  //       return `Error playing note: ${error instanceof Error ? error.message : 'Unknown error'}`;
  //     }
  //   }
  // });

  // Tool for playing a sequence of chords or notes
  // const playSequenceParameters = z.object({
  //   sequence: z.array(z.object({
  //     notes: z.array(z.string()).describe("Note names for this step"),
  //     velocity: z.number().min(1).max(127).default(100),
  //     duration: z.number().min(0.1).max(10).default(1),
  //     delay: z.number().min(0).max(5).default(0).describe("Delay before playing this step")
  //   })).describe("Sequence of chords/notes to play"),
  // });

  // const playSequenceTool = tool({
  //   name: 'play_sequence',
  //   description: 'Play a sequence of chords or notes with specified timing',
  //   parameters: playSequenceParameters,
  //   execute: async ({ sequence }: z.infer<typeof playSequenceParameters>) => {
  //     try {
  //       await pianoControls.initializeAudio();
        
  //       let totalTime = 0;
  //       const result: string[] = [];
        
  //       sequence.forEach((step, index: number) => {
  //         setTimeout(() => {
  //           const midiNotes = step.notes.map((note: string) => noteNameToMidi(note));
            
  //           // Play all notes in this step with visual feedback
  //           midiNotes.forEach((midiNote: number) => {
  //             pianoControls.playNote(midiNote, step.velocity);
  //             activeNotesRef.current.add(midiNote);
              
  //             // Trigger visual animation
  //             if (typeof window !== 'undefined' && window.animatePianoKey) {
  //               window.animatePianoKey(midiNote, true);
  //             }
  //           });
            
  //           // Stop notes after duration
  //           setTimeout(() => {
  //             midiNotes.forEach((midiNote: number) => {
  //               pianoControls.stopNote(midiNote);
  //               activeNotesRef.current.delete(midiNote);
                
  //               // Stop visual animation
  //               if (typeof window !== 'undefined' && window.animatePianoKey) {
  //                 window.animatePianoKey(midiNote, false);
  //               }
  //             });
  //           }, step.duration * 1000);
            
  //         }, totalTime + step.delay * 1000);
          
  //         totalTime += (step.delay + step.duration) * 1000;
  //         result.push(`Step ${index + 1}: [${step.notes.join(', ')}]`);
  //       });
        
  //       return `Playing sequence: ${result.join(' -> ')}`;
  //     } catch (error) {
  //       return `Error playing sequence: ${error instanceof Error ? error.message : 'Unknown error'}`;
  //     }
  //   }
  // });

  // Tool to stop all currently playing notes
  // const stopAllNotesTool = tool({
  //   name: 'stop_all_notes',
  //   description: 'Stop all currently playing piano notes',
  //   parameters: z.object({}),
  //   execute: async () => {
  //     try {
  //       // Stop all active notes and animations
  //       activeNotesRef.current.forEach((midiNote: number) => {
  //         pianoControls.stopNote(midiNote);
  //       });
  //       activeNotesRef.current.clear();
        
  //       // Stop all visual animations
  //       if (typeof window !== 'undefined' && window.stopAllPianoAnimations) {
  //         window.stopAllPianoAnimations();
  //       }
        
  //       return 'Stopped all playing notes';
  //     } catch (error) {
  //       return `Error stopping notes: ${error instanceof Error ? error.message : 'Unknown error'}`;
  //     }
  //   }
  // });

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
        throw new Error('OpenAI API key not found. Please set VITE_OPENAI_KEY.');
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
        clientTools: { playChordTool }
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
  }, [conversation, playChordTool]);

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
    playChordTool
  };
}
