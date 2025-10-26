import supabase from './supabase';
import type { Recording, RecordingEvent } from '../hooks/useRecording';
import { ticksToMs, MICROSECONDS_PER_QUARTER } from '../utils/midiTiming';

export interface RecordingData {
  id?: string; // UUID
  created_at?: string;
  audio?: string;
  midi?: string;
  title: string;
  country: string;
  duration?: number;
  events_count?: number;
  created_by?: string;
  is_public?: boolean;
  hearts?: string[]; // Array of author IDs who hearted this recording
}

export interface UploadRecordingParams {
  recording: Recording;
  title?: string; // Make title optional for immediate uploads
  country: string;
  isPublic?: boolean;
}

export interface RecordingEventsResult {
  events: RecordingEvent[];
  hasTempoMeta: boolean;
  microsecondsPerQuarter: number;
}


// Get user's country using a free geolocation service
export async function getUserCountry(): Promise<string> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return data.country_name || 'Unknown';
  } catch (error) {
    console.error('Error getting user country:', error);
    return 'Unknown';
  }
}

export async function getUser() {
  const { data, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error getting user:', error)
  }
  return data?.session?.user
}

// Upload recording to Supabase
export async function uploadRecording({ recording, title, country, isPublic = false }: UploadRecordingParams): Promise<RecordingData | null> {
  try {
    const user = await getUser()
    const recordingId = crypto.randomUUID()
    
    // Use a default title if none provided (for immediate uploads)
    const finalTitle = title || `Recording ${new Date().toLocaleString()}`;
    
    console.log('Upload recording called with:', { title: finalTitle, country, userId: user?.id, isPublic });
    console.log('Recording has audioUrl:', !!recording.audioUrl, 'mp3Url:', !!recording.mp3Url, 'midiUrl:', !!recording.midiUrl);
    
    // Check if we have any audio data
    if (!recording.audioUrl && !recording.mp3Url) {
      console.error('No audio data available for upload');
      return null;
    }
    // Upload audio file to storage
    let audioUrl: string | undefined;
    let audioFileName: string | undefined;
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    
    // Try WAV first, then fall back to original format
    if (recording.mp3Url) {
      try {
        console.log('Attempting to upload WAV file...');
        const audioResponse = await fetch(recording.mp3Url);
        const audioBlob = await audioResponse.blob();
        
        console.log('WAV blob size:', audioBlob.size, 'bytes');
        
        // Check file size - Supabase has limits
        const maxSize = 50 * 1024 * 1024; // 50MB limit
        if (audioBlob.size > maxSize) {
          console.warn('WAV file too large, falling back to original format');
          throw new Error('File too large');
        }
        
        audioFileName = `audio_${recordingId}.wav`;
        const audioPath = `recordings/${user?.id}/${audioFileName}`;
        
        const { error: audioError } = await supabase.storage
          .from('user-data')
          .upload(audioPath, audioBlob, {
            contentType: 'audio/wav',
            cacheControl: '3600'
          });
        
        if (audioError) {
          console.error('Error uploading WAV:', audioError);
          throw audioError;
        } else {
          const { data: audioUrlData } = supabase.storage
            .from('user-data')
            .getPublicUrl(audioPath);
          audioUrl = audioUrlData.publicUrl;
          console.log('WAV upload successful');
        }
      } catch (error) {
        console.warn('WAV upload failed, trying original format:', error);
        // Fall back to original format
        if (recording.audioUrl) {
          try {
            const originalResponse = await fetch(recording.audioUrl);
            const originalBlob = await originalResponse.blob();
            
            console.log('Original blob size:', originalBlob.size, 'bytes');
            
            if (originalBlob.size > maxSize) {
              console.error('Original file also too large');
              throw new Error('File too large');
            }
            
            // Determine file extension from MIME type
            const extension = originalBlob.type.includes('webm') ? 'webm' : 
                             originalBlob.type.includes('mp4') ? 'mp4' : 
                             originalBlob.type.includes('ogg') ? 'ogg' : 'wav';
            
            audioFileName = `audio_${recordingId}.${extension}`;
            const audioPath = `recordings/${user?.id}/${audioFileName}`;
            
            const { error: originalError } = await supabase.storage
              .from('user-data')
              .upload(audioPath, originalBlob, {
                contentType: originalBlob.type,
                cacheControl: '3600'
              });
            
            if (originalError) {
              console.error('Error uploading original format:', originalError);
            } else {
              const { data: audioUrlData } = supabase.storage
                .from('user-data')
                .getPublicUrl(audioPath);
              audioUrl = audioUrlData.publicUrl;
              console.log('Original format upload successful');
            }
          } catch (fallbackError) {
            console.error('Fallback upload also failed:', fallbackError);
          }
        }
      }
    } else if (recording.audioUrl) {
      // No WAV available, try original format
      try {
        const originalResponse = await fetch(recording.audioUrl);
        const originalBlob = await originalResponse.blob();
        
        console.log('Original blob size:', originalBlob.size, 'bytes');
        
        const maxSize = 50 * 1024 * 1024; // 50MB limit
        if (originalBlob.size > maxSize) {
          console.error('Original file too large');
        } else {
          const extension = originalBlob.type.includes('webm') ? 'webm' : 
                           originalBlob.type.includes('mp4') ? 'mp4' : 
                           originalBlob.type.includes('ogg') ? 'ogg' : 'wav';
          
          audioFileName = `audio_${recordingId}.${extension}`;
          const audioPath = `recordings/${user?.id}/${audioFileName}`;
          const { error: originalError } = await supabase.storage
            .from('user-data')
            .upload(audioPath, originalBlob, {
              contentType: originalBlob.type,
              cacheControl: '3600'
            });
          
          if (originalError) {
            console.error('Error uploading original format:', originalError);
          } else {
            const { data: audioUrlData } = supabase.storage
              .from('user-data')
              .getPublicUrl(audioPath);
            audioUrl = audioUrlData.publicUrl;
            console.log('Original format upload successful');
          }
        }
      } catch (error) {
        console.error('Error uploading original format:', error);
      }
    }

    // Upload MIDI file to storage
    let midiUrl: string | undefined;
    if (recording.midiUrl) {
      const midiResponse = await fetch(recording.midiUrl);
      const midiBlob = await midiResponse.blob();
      const midiFileName = `midi_${recordingId}.mid`;
      const midiPath = `recordings/${user?.id}/${midiFileName}`;
      
      const { error: midiError } = await supabase.storage
        .from('user-data')
        .upload(midiPath, midiBlob, {
          contentType: 'audio/midi',
          cacheControl: '3600'
        });
      
      if (midiError) {
        console.error('Error uploading MIDI:', midiError);
      } else {
        const { data: midiUrlData } = supabase.storage
          .from('user-data')
          .getPublicUrl(midiPath);
        midiUrl = midiUrlData.publicUrl;
      }
    }

    // Calculate duration and events count
    const duration = recording.events && recording.events.length > 0 
      ? recording.events[recording.events.length - 1].time / 1000 
      : 0;
    const eventsCount = recording.events?.length || 0;

    // Insert into database
    const { data, error } = await supabase
      .from('recordings')
      .insert({
        id: recordingId,
        created_by: user?.id,
        audio: audioUrl,
        midi: midiUrl,
        title: finalTitle,
        country,
        duration,
        events_count: eventsCount,
        is_public: isPublic,
        hearts: [] // Initialize empty hearts array
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting recording:', error);
      return null;
    }

    return data as RecordingData;
  } catch (error) {
    console.error('Error uploading recording:', error);
    return null;
  }
}

// Get a single recording by ID
export async function getRecording(id: string): Promise<RecordingData | null> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching recording:', error);
      return null;
    }

    return data as RecordingData;
  } catch (error) {
    console.error('Error fetching recording:', error);
    return null;
  }
}

// Get recordings with pagination
export async function getRecordingsPaginated(limit: number = 10, offset: number = 0): Promise<RecordingData[]> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching paginated recordings:', error);
      return [];
    }

    return data as RecordingData[];
  } catch (error) {
    console.error('Error fetching paginated recordings:', error);
    return [];
  }
}


// Delete a recording
export async function deleteRecording(id: string): Promise<boolean> {
  try {
    // First get the recording to find the file URLs
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching recording for deletion:', fetchError);
      return false;
    }

    // Delete files from storage
    if (recording.audio) {
      const audioPath = recording.audio.split('/').pop();
      if (audioPath) {
        await supabase.storage
          .from('user-data')
          .remove([`recordings/${audioPath}`]);
      }
    }

    if (recording.midi) {
      const midiPath = recording.midi.split('/').pop();
      if (midiPath) {
        await supabase.storage
          .from('user-data')
          .remove([`recordings/${midiPath}`]);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting recording:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting recording:', error);
    return false;
  }
}

// Heart a recording (add author ID to hearts array)
export async function heartRecording(id: string): Promise<boolean> {
  try {
    const user = await getUser()
    // First get the recording to get current hearts
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching recording for hearting:', fetchError);
      return false;
    }

    // Initialize hearts array if it doesn't exist
    const currentHearts = recording.hearts || [];
    
    // Add author ID if not already present
    if (!currentHearts.includes(user?.id)) {
      const updatedHearts = [...currentHearts, user?.id];
      
      const { error } = await supabase
        .from('recordings')
        .update({
          hearts: updatedHearts
        })
        .eq('id', id);

      if (error) {
        console.error('Error hearting recording:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error hearting recording:', error);
    return false;
  }
}

// Unheart a recording (remove author ID from hearts array)
export async function unheartRecording(id: string): Promise<boolean> {
  try {
    const user = await getUser()
    // First get the recording to get current hearts
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching recording for unhearting:', fetchError);
      return false;
    }

    // Get current hearts array
    const currentHearts = recording.hearts || [];
    
    // Remove author ID if present
    if (currentHearts.includes(user?.id)) {
      const updatedHearts = currentHearts.filter((heartId: string) => heartId !== user?.id);
      
      const { error } = await supabase
        .from('recordings')
        .update({
          hearts: updatedHearts
        })
        .eq('id', id);

      if (error) {
        console.error('Error unhearting recording:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error unhearting recording:', error);
    return false;
  }
} 

// Toggle the is_public property of a recording
export async function toggleRecordingPublic(id: string): Promise<boolean> {
  try {
    const user = await getUser()
    
    // First get the recording to get current public status
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching recording for public toggle:', fetchError);
      return false;
    }

    // Only allow the creator to toggle public status
    if (recording.created_by !== user?.id) {
      console.error('User not authorized to toggle public status');
      return false;
    }

    // Toggle the public status
    const newPublicStatus = !recording.is_public;
    
    const { error } = await supabase
      .from('recordings')
      .update({
        is_public: newPublicStatus
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling recording public status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error toggling recording public status:', error);
    return false;
  }
} 

// Update recording title
export async function updateRecordingTitle(id: string, newTitle: string): Promise<boolean> {
  try {
    const user = await getUser()
    
    // First get the recording to check ownership
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching recording for title update:', fetchError);
      return false;
    }

    // Only allow the creator to update the title
    if (recording.created_by !== user?.id) {
      console.error('User not authorized to update recording title');
      return false;
    }

    // Update the title
    const { error } = await supabase
      .from('recordings')
      .update({
        title: newTitle
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating recording title:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating recording title:', error);
    return false;
  }
}

// Get MIDI events from a recording for synchronized playback
export async function getRecordingEvents(recordingId: string): Promise<RecordingEventsResult> {
  try {
    // First get the recording to find the MIDI URL
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (fetchError || !recording.midi) {
      console.error('Error fetching recording or no MIDI data:', fetchError);
      return { events: [], hasTempoMeta: false, microsecondsPerQuarter: MICROSECONDS_PER_QUARTER };
    }

    // Fetch the MIDI file
    const response = await fetch(recording.midi);
    const midiBlob = await response.blob();
  	const arrayBuffer = await midiBlob.arrayBuffer();
    
    // Decode MIDI data to get events
    return decodeMidiToEvents(arrayBuffer);
  } catch (error) {
    console.error('Error getting recording events:', error);
    return { events: [], hasTempoMeta: false, microsecondsPerQuarter: MICROSECONDS_PER_QUARTER };
  }
}

// Simple MIDI decoder to extract note events
function decodeMidiToEvents(arrayBuffer: ArrayBuffer): RecordingEventsResult {
  const events: RecordingEvent[] = [];
  const dataView = new DataView(arrayBuffer);
  let offset = 0;
  let microsecondsPerQuarter = MICROSECONDS_PER_QUARTER;
  let hasTempoMeta = false;
  
  // Skip MIDI header
  if (dataView.getUint32(0) === 0x4D546864) { // 'MThd'
    offset = 14; // Skip header
  }
  
  // Find first track
  while (offset < arrayBuffer.byteLength) {
    if (dataView.getUint32(offset) === 0x4D54726B) { // 'MTrk'
      const trackLength = dataView.getUint32(offset + 4);
      offset += 8;
      const trackEnd = offset + trackLength;
      
      let absoluteTime = 0;
      while (offset < trackEnd) {
        // Read delta time
        let deltaTime = 0;
        let byte;
        do {
          byte = dataView.getUint8(offset++);
          deltaTime = (deltaTime << 7) | (byte & 0x7F);
        } while (byte & 0x80);
        
        absoluteTime += deltaTime;
        
        // Read event type
        const eventType = dataView.getUint8(offset++);
        
        if (eventType === 0xFF) {
          const metaType = dataView.getUint8(offset++);
          let metaLength = 0;
          do {
            byte = dataView.getUint8(offset++);
            metaLength = (metaLength << 7) | (byte & 0x7F);
          } while (byte & 0x80);
          const metaStart = offset;
          if (metaType === 0x51 && metaLength === 3) {
            hasTempoMeta = true;
            microsecondsPerQuarter =
              (dataView.getUint8(metaStart) << 16) |
              (dataView.getUint8(metaStart + 1) << 8) |
              dataView.getUint8(metaStart + 2);
          }
          offset += metaLength;
        } else if ((eventType & 0xF0) === 0x90) {
          // Note on
          const note = dataView.getUint8(offset++);
          const velocity = dataView.getUint8(offset++);
          if (velocity > 0) {
            events.push({
              type: 'on',
              note,
              velocity: velocity / 127,
              time: ticksToMs(absoluteTime, microsecondsPerQuarter)
            });
          } else {
            // Note off (velocity 0)
            events.push({
              type: 'off',
              note,
              velocity: 0,
              time: ticksToMs(absoluteTime, microsecondsPerQuarter)
            });
          }
        } else if ((eventType & 0xF0) === 0x80) {
          // Note off
          const note = dataView.getUint8(offset++);
          dataView.getUint8(offset++); // velocity
          events.push({
            type: 'off',
            note,
            velocity: 0,
            time: ticksToMs(absoluteTime, microsecondsPerQuarter)
          });
        } else {
          // Other event, skip
          offset++;
        }
      }
      break; // Only process first track
    }
    offset++;
  }
  
  events.sort((a, b) => a.time - b.time);
  return {
    events,
    hasTempoMeta,
    microsecondsPerQuarter,
  };
} 
