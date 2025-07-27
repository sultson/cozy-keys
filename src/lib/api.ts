import supabase from './supabase';
import type { Recording } from '../hooks/useRecording';

export interface RecordingData {
  id?: number;
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
  type: 'recording';
}

export interface UploadRecordingParams {
  recording: Recording;
  title: string;
  country: string;
  isPublic?: boolean;
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
    console.log('Upload recording called with:', { title, country, userId: user?.id, isPublic });
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
        
        audioFileName = `recordings/audio_${recordingId}.wav`;
        
        const { error: audioError } = await supabase.storage
          .from('user-data')
          .upload(audioFileName, audioBlob, {
            contentType: 'audio/wav',
            cacheControl: '3600'
          });
        
        if (audioError) {
          console.error('Error uploading WAV:', audioError);
          throw audioError;
        } else {
          const { data: audioUrlData } = supabase.storage
            .from('user-data')
            .getPublicUrl(audioFileName);
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
            
            audioFileName = `recordings/audio_${recordingId}.${extension}`;
            
            const { error: originalError } = await supabase.storage
              .from('user-data')
              .upload(audioFileName, originalBlob, {
                contentType: originalBlob.type,
                cacheControl: '3600'
              });
            
            if (originalError) {
              console.error('Error uploading original format:', originalError);
            } else {
              const { data: audioUrlData } = supabase.storage
                .from('user-data')
                .getPublicUrl(audioFileName);
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
          
          audioFileName = `recordings/audio_${recordingId}.${extension}`;
          
          const { error: originalError } = await supabase.storage
            .from('user-data')
            .upload(audioFileName, originalBlob, {
              contentType: originalBlob.type,
              cacheControl: '3600'
            });
          
          if (originalError) {
            console.error('Error uploading original format:', originalError);
          } else {
            const { data: audioUrlData } = supabase.storage
              .from('user-data')
              .getPublicUrl(audioFileName);
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
      const midiFileName = `recordings/midi_${recordingId}.mid`;
      
      const { error: midiError } = await supabase.storage
        .from('user-data')
        .upload(midiFileName, midiBlob, {
          contentType: 'audio/midi',
          cacheControl: '3600'
        });
      
      if (midiError) {
        console.error('Error uploading MIDI:', midiError);
      } else {
        const { data: midiUrlData } = supabase.storage
          .from('user-data')
          .getPublicUrl(midiFileName);
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
        title,
        country,
        duration,
        events_count: eventsCount,
        is_public: isPublic
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

// Get all recordings from Supabase
export async function getRecordings(): Promise<RecordingData[]> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }

    return data as RecordingData[];
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return [];
  }
}


// Delete a recording
export async function deleteRecording(id: number): Promise<boolean> {
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
export async function heartRecording(id: number): Promise<boolean> {
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
export async function unheartRecording(id: number): Promise<boolean> {
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