import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { getRecordings, uploadRecording, getUserCountry,heartRecording as heartRecordingApi, unheartRecording as unheartRecordingApi, type RecordingData } from '../lib/api';

export interface RecordingEvent {
  type: 'on' | 'off';
  note: number;
  velocity: number;
  time: number;
}

export interface Recording {
  startedAt: number;
  events: RecordingEvent[];
  timestamp: Date;
  audioUrl?: string | null;
  midiUrl?: string | null;
  mp3Url?: string | null;
}

interface UseRecordingReturn {
  isRecording: boolean;
  recordings: Recording[];
  cloudRecordings: RecordingData[];
  isLoading: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  recordEvent: (type: 'on' | 'off', note: number, velocity: number) => void;
  clearRecordings: () => void;
  playRecording: (recording: Recording, options?: {
    onEvent?: (event: RecordingEvent) => void;
    onDone?: () => void;
  }) => void;
  stopPlayback: () => void;
  uploadToCloud: (title: string, recording?: Recording) => Promise<boolean>;
  refreshCloudRecordings: () => Promise<void>;
  deleteLocalRecording: (recording: Recording) => void;
  heartRecording: (id: number) => Promise<boolean>;
  unheartRecording: (id: number) => Promise<boolean>;
}




// --- Minimal MIDI encoder ---
function encodeMidi(events: RecordingEvent[]): Uint8Array {
  // Only encodes note on/off, single track, 480 ticks/quarter
  function writeVarLen(val: number) {
    const buffer = [];
    let v = val & 0x7F;
    while ((val >>= 7)) {
      v <<= 8;
      v |= ((val & 0x7F) | 0x80);
    }
    while (true) {
      buffer.push(v & 0xFF);
      if (v & 0x80) v >>= 8; else break;
    }
    return buffer;
  }
  const header = [
    ...[0x4d,0x54,0x68,0x64], // 'MThd'
    ...[0x00,0x00,0x00,0x06], // header length
    ...[0x00,0x00], // format 0
    ...[0x00,0x01], // one track
    ...[0x01,0xe0], // 480 ticks/quarter
  ];
  const track: number[] = [0x4d,0x54,0x72,0x6b,0,0,0,0]; // 'MTrk' + length placeholder
  let lastTime = 0;
  for (const ev of events) {
    const delta = Math.round(ev.time * 0.48 - lastTime); // ms to ticks
    lastTime += delta;
    track.push(...writeVarLen(delta));
    if (ev.type === 'on') {
      track.push(0x90, ev.note, Math.max(1, Math.round(ev.velocity * 127)));
    } else {
      track.push(0x80, ev.note, 0);
    }
  }
  // End of track
  track.push(0x00, 0xFF, 0x2F, 0x00);
  // Write track length
  const trackLen = track.length - 8;
  track[4] = (trackLen >>> 24) & 0xFF;
  track[5] = (trackLen >>> 16) & 0xFF;
  track[6] = (trackLen >>> 8) & 0xFF;
  track[7] = trackLen & 0xFF;
  return new Uint8Array([...header, ...track]);
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cloudRecordings, setCloudRecordings] = useState<RecordingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentRecordingRef = useRef<Recording | null>(null);
  const playbackTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isRecordingRef = useRef<boolean>(false); // Track recording state with ref for immediate access

  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const midiUrlRef = useRef<string | null>(null);
  const wavUrlRef = useRef<string | null>(null);
  const toneConnectedRef = useRef<boolean>(false); // NEW: track if Tone.Destination is connected

  const now = useCallback(() => performance.now(), []);

  // Save recordings to localStorage
  const saveRecordingsToStorage = useCallback(async (newRecordings: Recording[]) => {
    try {
      // Convert blob URLs to base64 for localStorage storage
      const recordingsForStorage = await Promise.all(
        newRecordings.map(async (recording) => {
          const storageRecording = { ...recording };
          
          // Convert audio blob to base64
          if (recording.audioUrl && recording.audioUrl.startsWith('blob:')) {
            try {
              const response = await fetch(recording.audioUrl);
              const blob = await response.blob();
              const base64 = await blobToBase64(blob);
              storageRecording.audioUrl = base64;
            } catch (error) {
              console.error('Error converting audio to base64:', error);
              storageRecording.audioUrl = null;
            }
          }
          
          // Convert MIDI blob to base64
          if (recording.midiUrl && recording.midiUrl.startsWith('blob:')) {
            try {
              const response = await fetch(recording.midiUrl);
              const blob = await response.blob();
              const base64 = await blobToBase64(blob);
              storageRecording.midiUrl = base64;
            } catch (error) {
              console.error('Error converting MIDI to base64:', error);
              storageRecording.midiUrl = null;
            }
          }
          
          // Convert WAV blob to base64
          if (recording.mp3Url && recording.mp3Url.startsWith('blob:')) {
            try {
              const response = await fetch(recording.mp3Url);
              const blob = await response.blob();
              const base64 = await blobToBase64(blob);
              storageRecording.mp3Url = base64;
            } catch (error) {
              console.error('Error converting WAV to base64:', error);
              storageRecording.mp3Url = null;
            }
          }
          
          return storageRecording;
        })
      );
      
      localStorage.setItem('cozy-keys-recordings', JSON.stringify(recordingsForStorage));
    } catch (error) {
      console.error('Error saving recordings to localStorage:', error);
    }
  }, []);

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Convert WebM to WAV using Web Audio API
  const convertToWav = useCallback(async (webmBlob: Blob): Promise<string | null> => {
    try {
      console.log('Starting WAV conversion, blob size:', webmBlob.size, 'bytes');
      
      // Create audio context and decode the WebM audio
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('Audio decoded, duration:', audioBuffer.duration, 'seconds');
      
      // For very long recordings, we might want to limit the conversion
      const maxDuration = 300; // 5 minutes max
      if (audioBuffer.duration > maxDuration) {
        console.warn(`Recording too long (${audioBuffer.duration}s), limiting to ${maxDuration}s`);
        // We could truncate here, but for now let's just return null
        return null;
      }
      
      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      // Render the audio with timeout
      const renderPromise = offlineContext.startRendering();
      const timeoutPromise = new Promise<AudioBuffer>((_, reject) => {
        setTimeout(() => reject(new Error('WAV conversion timeout')), 30000); // 30 second timeout
      });
      
      const renderedBuffer = await Promise.race([renderPromise, timeoutPromise]);
      
      console.log('Audio rendered, converting to WAV...');
      
      // Convert to WAV format
      const wavBlob = audioBufferToWav(renderedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);
      
      console.log('WAV conversion complete, size:', wavBlob.size, 'bytes');
      
      return wavUrl;
    } catch (error) {
      console.error('Error converting to WAV:', error);
      return null;
    }
  }, []);

  // Helper function to convert AudioBuffer to WAV format
  const audioBufferToWav = useCallback((buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }, []);

  // Set up the destination node and connect Tone.js output
  const ensureDestination = useCallback(() => {
    if (!destRef.current) {
      const ctx = Tone.getContext().rawContext;
      if ('createMediaStreamDestination' in ctx) {
        const dest = ctx.createMediaStreamDestination();
        Tone.Destination.connect(dest);
        destRef.current = dest;
      } else {
        console.error('MediaStreamDestination not supported in this context');
        return null;
      }
    }
    // Only connect Tone.Destination once
    if (typeof window !== 'undefined' && window.Tone && !toneConnectedRef.current && destRef.current) {
      if (window.Tone.Destination && typeof window.Tone.Destination.connect === 'function') {
        window.Tone.Destination.connect(destRef.current);
        toneConnectedRef.current = true;
      }
    }
    return destRef.current;
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) return;
    console.log('Starting recording...');
    setIsRecording(true);
    isRecordingRef.current = true; // Set ref immediately
    // Start MIDI event recording
    currentRecordingRef.current = {
      startedAt: now(),
      events: [],
      timestamp: new Date(),
      audioUrl: null,
      midiUrl: null,
    };
    console.log('Recording started, currentRecordingRef set:', currentRecordingRef.current);
    // Start audio recording
    const dest = ensureDestination();
    if (dest) {
      chunksRef.current = [];
      // Try to use the best supported audio format
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      
      let selectedMimeType = 'audio/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const recorder = new MediaRecorder(dest.stream, { mimeType: selectedMimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: selectedMimeType });
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;
            
            console.log('Recording stopped, blob size:', blob.size, 'bytes');
            
            // Convert to WAV format for better compatibility
            const wavUrl = await convertToWav(blob);
            wavUrlRef.current = wavUrl;
            
            if (wavUrl) {
              console.log('WAV conversion successful');
            } else {
              console.warn('WAV conversion failed, will use original format');
            }
          }
        }
      };
      recorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = recorder;
    }
  }, [isRecording, now, ensureDestination, convertToWav]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    console.log('Stopping recording...');
    setIsRecording(false);
    isRecordingRef.current = false; // Set ref immediately
    
    // Stop audio recording first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Wait for audio recording to finish, then add to recordings
    const checkAudioAndAdd = () => {
      if (currentRecordingRef.current) {
        // Generate MIDI file
        const midiBytes = encodeMidi(currentRecordingRef.current.events);
        const midiBlob = new Blob([midiBytes], { type: 'audio/midi' });
        const midiUrl = URL.createObjectURL(midiBlob);
        
        // Ensure we have valid data before adding to recordings
        const recording = {
          ...currentRecordingRef.current,
          startedAt: currentRecordingRef.current.startedAt || now(),
          timestamp: currentRecordingRef.current.timestamp || new Date(),
          events: currentRecordingRef.current.events || [],
          audioUrl: audioUrlRef.current || null,
          midiUrl: midiUrl,
          mp3Url: wavUrlRef.current || null,
        };
        setRecordings(prev => {
          const newRecordings = [recording, ...prev]; // newest first
          saveRecordingsToStorage(newRecordings).catch(error => {
            console.error('Error saving recordings to storage:', error);
          });
          return newRecordings;
        });
      }
      currentRecordingRef.current = null;
      audioUrlRef.current = null;
      midiUrlRef.current = null;
      wavUrlRef.current = null;
    };
    
    // Give audio recording a moment to finish, then add to recordings
    setTimeout(checkAudioAndAdd, 100);
  }, [isRecording, now]);

  const recordEvent = useCallback((type: 'on' | 'off', note: number, velocity: number) => {
    console.log(`recordEvent called: type=${type}, note=${note}, velocity=${velocity}, isRecording=${isRecording}, isRecordingRef=${isRecordingRef.current}, currentRecordingRef=${!!currentRecordingRef.current}`);
    
    if (!isRecordingRef.current || !currentRecordingRef.current) {
      console.log('Recording not active, ignoring event');
      return;
    }
    
    // Ensure events array exists
    if (!currentRecordingRef.current.events) {
      currentRecordingRef.current.events = [];
    }
    
    // Ensure startedAt is set
    if (!currentRecordingRef.current.startedAt) {
      currentRecordingRef.current.startedAt = now();
    }
    
    currentRecordingRef.current.events.push({
      type,
      note,
      velocity,
      time: now() - currentRecordingRef.current.startedAt,
    });
    
    console.log(`Recorded ${type} event for note ${note} at time ${now() - currentRecordingRef.current.startedAt}ms`);
  }, [now]);

  const clearRecordings = useCallback(() => {
    setRecordings([]);
    saveRecordingsToStorage([]).catch(error => {
      console.error('Error saving recordings to storage:', error);
    });
  }, [saveRecordingsToStorage]);

  const stopPlayback = useCallback(() => {
    playbackTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    playbackTimeoutsRef.current = [];
    // Stop all notes using global functions if available
    if (typeof window !== 'undefined' && window.stopNote) {
      for (let n = 21; n <= 108; n++) {
        window.stopNote(n);
      }
    }
  }, []);

  const playRecording = useCallback((recording: Recording, options: {
    onEvent?: (event: RecordingEvent) => void;
    onDone?: () => void;
  } = {}) => {
    // MIDI playback is now optional; playback is audio only in UI
    // This function is kept for compatibility
    if (!recording || !recording.events || recording.events.length === 0) return;
    stopPlayback();
    recording.events.forEach(event => {
      const timeout = setTimeout(() => {
        if (options.onEvent) options.onEvent(event);
        if (typeof window !== 'undefined') {
          if (event.type === 'on' && window.playNote) {
            window.playNote(event.note, event.velocity);
          } else if (event.type === 'off' && window.stopNote) {
            window.stopNote(event.note);
          }
        }
      }, event.time);
      playbackTimeoutsRef.current.push(timeout);
    });
    // Call onDone after last event
    if (recording.events.length > 0) {
      const lastTime = recording.events[recording.events.length - 1].time;
      const doneTimeout = setTimeout(() => {
        if (options.onDone) options.onDone();
      }, lastTime + 100);
      playbackTimeoutsRef.current.push(doneTimeout);
    }
  }, [stopPlayback]);

  // Load recordings from localStorage on mount
  useEffect(() => {
    const loadRecordingsFromStorage = async () => {
      try {
        const saved = localStorage.getItem('cozy-keys-recordings');
        if (saved) {
          const parsedRecordings = JSON.parse(saved);
          
          // Convert base64 data back to blob URLs
          const recordingsWithBlobs = await Promise.all(
            parsedRecordings.map(async (recording: Recording & { audioUrl?: string | null; midiUrl?: string | null; mp3Url?: string | null }) => {
              const restoredRecording = { ...recording };
              
              // Convert base64 audio back to blob URL
              if (recording.audioUrl && recording.audioUrl.startsWith('data:')) {
                try {
                  const response = await fetch(recording.audioUrl);
                  const blob = await response.blob();
                  restoredRecording.audioUrl = URL.createObjectURL(blob);
                } catch (error) {
                  console.error('Error converting base64 audio to blob:', error);
                  restoredRecording.audioUrl = null;
                }
              }
              
              // Convert base64 MIDI back to blob URL
              if (recording.midiUrl && recording.midiUrl.startsWith('data:')) {
                try {
                  const response = await fetch(recording.midiUrl);
                  const blob = await response.blob();
                  restoredRecording.midiUrl = URL.createObjectURL(blob);
                } catch (error) {
                  console.error('Error converting base64 MIDI to blob:', error);
                  restoredRecording.midiUrl = null;
                }
              }
              
              // Convert base64 MP3 back to blob URL
              if (recording.mp3Url && recording.mp3Url.startsWith('data:')) {
                try {
                  const response = await fetch(recording.mp3Url);
                  const blob = await response.blob();
                  restoredRecording.mp3Url = URL.createObjectURL(blob);
                } catch (error) {
                  console.error('Error converting base64 MP3 to blob:', error);
                  restoredRecording.mp3Url = null;
                }
              }
              
              return restoredRecording;
            })
          );
          
          setRecordings(recordingsWithBlobs);
        }
      } catch (error) {
        console.error('Error loading recordings from localStorage:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadRecordingsFromStorage();
  }, []);

  // Load cloud recordings on mount
  useEffect(() => {
    if (isInitialized) {
      refreshCloudRecordings();
    }
  }, [isInitialized]);

  const uploadToCloud = useCallback(async (title: string, recording?: Recording): Promise<boolean> => {
    const recordingToUpload = recording || (recordings.length > 0 ? recordings[0] : null);
    if (!recordingToUpload) return false;
    
    setIsLoading(true);
    try {
      console.log('Starting cloud upload for recording:', recordingToUpload);
      
      const country = await getUserCountry();
      
      const result = await uploadRecording({
        recording: recordingToUpload,
        title,
        country,
        isPublic: true // Make it public immediately
      });
      
      if (result) {
        console.log('Upload successful, removing local recording');
        // Remove the local recording after successful upload
        setRecordings(prev => {
          const newRecordings = prev.filter(r => r !== recordingToUpload);
          saveRecordingsToStorage(newRecordings).catch(error => {
            console.error('Error saving recordings to storage:', error);
          });
          return newRecordings;
        });
        await refreshCloudRecordings();
        return true;
      } else {
        console.error('Upload failed - no result returned');
        return false;
      }
    } catch (error) {
      console.error('Error uploading to cloud:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [recordings, saveRecordingsToStorage]);

 

  const refreshCloudRecordings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const cloudRecs = await getRecordings();
      setCloudRecordings(cloudRecs);
    } catch (error) {
      console.error('Error refreshing cloud recordings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteLocalRecording = useCallback((recording: Recording) => {
    setRecordings(prev => {
      const newRecordings = prev.filter(r => r !== recording);
      saveRecordingsToStorage(newRecordings).catch(error => {
        console.error('Error saving recordings to storage:', error);
      });
      return newRecordings;
    });
  }, [saveRecordingsToStorage]);

  const heartRecording = useCallback(async (id: number): Promise<boolean> => {
    try {
      const success = await heartRecordingApi(id);
      if (success) {
        await refreshCloudRecordings();
      }
      return success;
    } catch (error) {
      console.error('Error hearting recording:', error);
      return false;
    }
  }, [refreshCloudRecordings]);

  const unheartRecording = useCallback(async (id: number): Promise<boolean> => {
    try {
      const success = await unheartRecordingApi(id);
      if (success) {
        await refreshCloudRecordings();
      }
      return success;
    } catch (error) {
      console.error('Error unhearting recording:', error);
      return false;
    }
  }, [refreshCloudRecordings]);

  return {
    isRecording,
    recordings,
    cloudRecordings,
    isLoading,
    startRecording,
    stopRecording,
    recordEvent,
    clearRecordings,
    playRecording,
    stopPlayback,
    uploadToCloud,
    refreshCloudRecordings,
    deleteLocalRecording,
    heartRecording,
    unheartRecording,
  };
}

// Extend window type for global functions
declare global {
  interface Window {
    playNote?: (note: number, velocity: number) => void;
    stopNote?: (note: number) => void;
    Tone?: typeof import('tone');
  }
} 