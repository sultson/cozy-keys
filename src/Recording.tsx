import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play, Square, Download, Heart, Trash2, Globe as GlobeIcon, Link as LinkIcon } from 'lucide-react';
import { getRecording, deleteRecording, heartRecording, unheartRecording, toggleRecordingPublic } from './lib/api';
import type { RecordingData } from './lib/api';
import { getCountryFlag } from './utils/countryFlags';
import { timeAgo, formatExactDate } from './utils/timeAgo';
import { drawWaveform, createWaveformData } from './utils/drawWaveform';
import { formatDuration } from './utils/formatDuration';
import useAuth from './hooks/useAuth';
import type { SoundPreset } from './hooks/useSound';

const presetLabels: Record<SoundPreset, string> = {
  'grand-piano': 'Grand Piano',
  'juno': 'Juno Synth',
  'organ': 'Hammond Organ',
  'kalimba': 'Kalimba',
  'moog': 'Moog',
  'ob-xa-brass': 'OB-Xa Brass',
};

export default function RecordingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const userId = session?.user?.id;
  
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isOwnRecording = userId && recording?.created_by === userId;
  const isHearted = userId ? recording?.hearts?.includes(userId) || false : false;

  useEffect(() => {
    if (!id) {
      setError('No recording ID provided');
      setIsLoading(false);
      return;
    }

    const fetchRecording = async () => {
      try {
        const data = await getRecording(id);
        if (data) {
          setRecording(data);
          
          // Load waveform data if audio is available
          if (data.audio) {
            try {
              const waveformData = await createWaveformData(data.audio);
              setWaveformData(waveformData);
            } catch (err) {
              console.error('Error loading waveform:', err);
            }
          }
        } else {
          setError('Recording not found');
        }
      } catch (err) {
        setError('Failed to load recording');
        console.error('Error fetching recording:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecording();
  }, [id]);

  const handleDelete = async () => {
    if (!recording?.id || !isOwnRecording) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteRecording(recording.id);
      if (success) {
        navigate('/');
      } else {
        setError('Failed to delete recording');
      }
    } catch (err) {
      setError('Failed to delete recording');
      console.error('Error deleting recording:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHeart = async () => {
    if (!recording?.id) return;
    try {
      const success = await heartRecording(recording.id);
      if (success && recording) {
        setRecording({
          ...recording,
          hearts: [...(recording.hearts || []), userId!]
        });
      }
    } catch (err) {
      console.error('Error hearting recording:', err);
    }
  };

  const handleUnheart = async () => {
    if (!recording?.id) return;
    try {
      const success = await unheartRecording(recording.id);
      if (success && recording) {
        setRecording({
          ...recording,
          hearts: recording.hearts?.filter(heartId => heartId !== userId) || []
        });
      }
    } catch (err) {
      console.error('Error unhearting recording:', err);
    }
  };

  const handleCopyLink = async () => {
    if (!recording?.id) return;
    
    setIsCopying(true);
    try {
      const recordingUrl = `${window.location.origin}/recording/${recording.id}`;
      await navigator.clipboard.writeText(recordingUrl);
      
      // Show brief success feedback
      setTimeout(() => {
        setIsCopying(false);
      }, 1000);
    } catch (error) {
      console.error('Error copying link:', error);
      setIsCopying(false);
    }
  };

  const handleDownload = async (url: string, baseFilename: string, isAudio: boolean = true) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Determine file extension from Content-Type header or blob type
      let extension = 'wav'; // default fallback
      if (isAudio) {
        const contentType = response.headers.get('content-type') || blob.type || '';
        if (contentType.includes('webm')) {
          extension = 'webm';
        } else if (contentType.includes('mp4')) {
          extension = 'mp4';
        } else if (contentType.includes('ogg')) {
          extension = 'ogg';
        } else if (contentType.includes('wav')) {
          extension = 'wav';
        } else if (contentType.includes('mpeg') || contentType.includes('mp3')) {
          extension = 'mp3';
        } else {
          // Try to infer from URL
          const urlLower = url.toLowerCase();
          if (urlLower.includes('.webm')) extension = 'webm';
          else if (urlLower.includes('.mp4')) extension = 'mp4';
          else if (urlLower.includes('.ogg')) extension = 'ogg';
          else if (urlLower.includes('.mp3')) extension = 'mp3';
          else if (urlLower.includes('.wav')) extension = 'wav';
        }
      } else {
        extension = 'mid'; // MIDI files
      }
      
      // Remove any existing extension from baseFilename and add the correct one
      const filenameWithoutExt = baseFilename.replace(/\.[^/.]+$/, '');
      const finalFilename = `${filenameWithoutExt}.${extension}`;
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback to direct link if fetch fails
      const link = document.createElement('a');
      link.href = url;
      link.download = baseFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleTogglePublic = async () => {
    if (!recording?.id) return;
    try {
      const success = await toggleRecordingPublic(recording.id);
      if (success && recording) {
        setRecording({
          ...recording,
          is_public: !recording.is_public
        });
      }
    } catch (err) {
      console.error('Error toggling recording public status:', err);
    }
  };

  const play = () => {
    if (audioRef) {
      audioRef.play();
      setIsPlaying(true);
      setHasEnded(false);
    }
  };

  const stop = () => {
    if (audioRef) {
      audioRef.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    const audio = audioRef;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setHasEnded(true);
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setHasEnded(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioRef]);

  // Draw waveform with progress
  useEffect(() => {
    if (!canvasRef.current || !waveformData) return;

    const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
    const storedDuration = recording?.duration || 0;
    const referenceDuration = audioDuration > 0 ? audioDuration : storedDuration;
    const progress = referenceDuration > 0 ? Math.min(1, currentTime / referenceDuration) : 0;

    drawWaveform({
      canvas: canvasRef.current,
      data: waveformData,
      progress,
      options: {
        width: 800,
        height: 80,
        waveformColor: 'rgba(47, 64, 255, 0.7)',
        progressColor: 'rgba(59, 130, 246, 0.3)',
        progressLineColor: '#3b82f6',
        centerLineColor: 'rgba(137, 137, 137, 0.5)',
      }
    });
  }, [waveformData, currentTime, duration, recording?.duration]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground">Loading recording...</div>
        </div>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || 'Recording not found'}</div>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const storedDuration = recording.duration || 0;
  const referenceDuration = audioDuration > 0 ? audioDuration : storedDuration;
  const durationText = referenceDuration > 0 ? formatDuration(referenceDuration) : '0:00';

  const timestamp = recording.created_at ? new Date(recording.created_at) : new Date();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur p-4">
        <div className="mx-auto flex items-center justify-between px-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Keys
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="h-full flex flex-row justify-center items-center">
        <Card className="mb-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2">{recording.title}</h1>
                <div className="flex items-center gap-2 mb-2">
                  {isOwnRecording && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      Me
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${recording.is_public ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
                    {recording.is_public ? 'Public' : 'Private'}
                  </span>
                  {recording.preset && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                      {presetLabels[recording.preset]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span title={formatExactDate(timestamp)}>{timeAgo(timestamp)}</span>
                  <span>by {isOwnRecording ? 'me' : 'someone'} from {getCountryFlag(recording.country)} {recording.country}</span>
                  {recording.duration && (
                    <span>• {durationText}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Audio Player */}
            {recording.audio && (
              <div className="space-y-4 flex flex-row gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={isPlaying ? stop : play}
                    className="h-12 w-12 rounded-full"
                    disabled={!recording.audio}
                  >
                    {isPlaying && !hasEnded ? (
                      <Square className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>
                  
                
                </div>

                {/* Waveform Visualization */}
                {waveformData && (
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={80}
                      className="w-full h-20 rounded-md shadow-inner border border-border"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {durationText}
                    </div>
                  </div>
                )}

                <audio 
                  ref={setAudioRef}
                  src={recording.audio} 
                  controls 
                  className="hidden" 
                />
              </div>
            )}


            {/* Action buttons row - download buttons on left, action buttons on right */}
            <div className="flex items-center justify-between gap-1 mt-4 pt-4 border-t border-border">
              {/* Download buttons on the left */}
              <div className="flex items-center gap-1">
                {/* Download Audio Button */}
                {recording.audio && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-500 hover:text-blue-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownload(recording.audio!, recording.title, true);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Audio
                  </Button>
                )}

                {/* Download MIDI Button */}
                {recording.midi && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-500 hover:text-blue-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownload(recording.midi!, recording.title, false);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    MIDI
                  </Button>
                )}
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-1">
                {/* Toggle Public Button (only for own recordings) */}
                {isOwnRecording && recording.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleTogglePublic}
                    className={`flex-shrink-0 h-10 w-10 rounded-full text-gray-500 hover:text-blue-500 ${recording.is_public ? 'text-blue-500' : 'text-gray-500'}`}
                    title={recording.is_public ? 'Make Private' : 'Make Public'}
                  >
                    <GlobeIcon className="h-5 w-5" />
                  </Button>
                )}

                {/* Delete Button (only for own recordings) */}
                {isOwnRecording && recording.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-shrink-0 h-10 w-10 rounded-full text-gray-500 hover:text-red-500"
                    title="Delete recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

                {/* Copy Link Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLink}
                  disabled={isCopying}
                  className="flex-shrink-0 h-10 w-10 rounded-full text-gray-500 hover:text-blue-500 relative"
                  title="Copy link to clipboard"
                >
                  {isCopying ? (
                    <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LinkIcon className="h-5 w-5" />
                  )}
                </Button>

                {/* Heart Button */}
                {recording.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={isHearted ? handleUnheart : handleHeart}
                    className={`flex-shrink-0 h-10 w-10 rounded-full ${isHearted ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 relative`}
                    title={isHearted ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className="h-5 w-5" />
                    {recording.hearts && recording.hearts.length > 0 && (
                      <div className="text-xs text-muted-foreground absolute bottom-0 rounded-full w-full">
                        <span>{recording.hearts.length}</span>
                      </div>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
