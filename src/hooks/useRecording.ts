import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { getRecordingsPaginated, uploadRecording, getUserCountry, type RecordingData } from '../lib/api';
import { toast } from 'sonner';

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
  recordings: RecordingData[];
  isLoading: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  recordEvent: (type: 'on' | 'off', note: number, velocity: number) => void;
  refreshRecordings: () => Promise<void>;
  loadMoreRecordings: () => Promise<void>;
  hasMoreRecordings: boolean;
  isLoadingMore: boolean;
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
  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreRecordings, setHasMoreRecordings] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const currentRecordingRef = useRef<Recording | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const midiUrlRef = useRef<string | null>(null);
  const wavUrlRef = useRef<string | null>(null);
  const toneConnectedRef = useRef<boolean>(false);

  const now = useCallback(() => performance.now(), []);

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
        setTimeout(() => reject(new Error('WAV conversion timeout')), 30000);
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
    isRecordingRef.current = true;
    
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

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    console.log('Stopping recording...');
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // Stop audio recording first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Wait for audio recording to finish, then upload to cloud
    const uploadToCloud = async () => {

      if (currentRecordingRef.current) {
        setIsLoading(true);
        const toastId = toast('Saving...');
        try {
          // Generate MIDI file
          const midiBytes = encodeMidi(currentRecordingRef.current.events);
          const midiBlob = new Blob([midiBytes], { type: 'audio/midi' });
          const midiUrl = URL.createObjectURL(midiBlob);
          
          // Create temporary recording object for upload
          const tempRecording = {
            ...currentRecordingRef.current,
            startedAt: currentRecordingRef.current.startedAt || now(),
            timestamp: currentRecordingRef.current.timestamp || new Date(),
            events: currentRecordingRef.current.events || [],
            audioUrl: audioUrlRef.current || null,
            midiUrl: midiUrl,
            mp3Url: wavUrlRef.current || null,
          };
          
          const country = await getUserCountry();
          
          const result = await uploadRecording({
            recording: tempRecording,
            country,
            isPublic: false // Start as private
          });
          
          if (result) {
            console.log('Recording uploaded successfully');
            toast.success('Saved', { id: toastId });
            await refreshRecordings();
          } else {
            console.error('Failed to upload recording');
            toast.error('Failed to save', { id: toastId });
          }
        } catch (error) {
          console.error('Error uploading recording:', error);
        } finally {
          setIsLoading(false);
        }
      }
      currentRecordingRef.current = null;
      audioUrlRef.current = null;
      midiUrlRef.current = null;
      wavUrlRef.current = null;
    };
    
    // Give audio recording a moment to finish, then upload
    setTimeout(uploadToCloud, 100);
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

  const refreshRecordings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const cloudRecs = await getRecordingsPaginated(10, 0);
      setRecordings(cloudRecs);
      setCurrentOffset(10);
      setHasMoreRecordings(cloudRecs.length === 10);
    } catch (error) {
      console.error('Error refreshing recordings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreRecordings = useCallback(async (): Promise<void> => {
    if (isLoadingMore || !hasMoreRecordings) return;
    
    setIsLoadingMore(true);
    try {
      const moreRecordings = await getRecordingsPaginated(10, currentOffset);
      if (moreRecordings.length > 0) {
        setRecordings(prev => [...prev, ...moreRecordings]);
        setCurrentOffset(prev => prev + moreRecordings.length);
        setHasMoreRecordings(moreRecordings.length === 10);
      } else {
        setHasMoreRecordings(false);
      }
    } catch (error) {
      console.error('Error loading more recordings:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentOffset, hasMoreRecordings, isLoadingMore]);

  // Load recordings from cloud on mount
  useEffect(() => {
    refreshRecordings();
  }, [refreshRecordings]);

  return {
    isRecording,
    recordings,
    isLoading,
    startRecording,
    stopRecording,
    recordEvent,
    refreshRecordings,
    loadMoreRecordings,
    hasMoreRecordings,
    isLoadingMore,
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