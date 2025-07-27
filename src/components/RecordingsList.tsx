import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Recording } from '../hooks/useRecording';
import type { RecordingData } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, Square, Mic, Download, Trash2, Globe as GlobeIcon, Users, User, Heart, Link as LinkIcon } from 'lucide-react';
import { getCountryFlag } from '../utils/countryFlags';
import { timeAgo, formatExactDate } from '../utils/timeAgo';
import { drawWaveform, createWaveformData } from '../utils/drawWaveform';
import { formatDuration } from '../utils/formatDuration';

interface RecordingsListProps {
  recordings: Recording[];
  cloudRecordings: RecordingData[];
  onStopPlayback: () => void;
  isSoundOn: boolean;
  onUploadToCloud?: (title: string, recording?: Recording) => Promise<boolean>;
  onDeleteCloudRecording?: (id: number) => Promise<boolean>;
  onHeartRecording?: (id: number) => Promise<boolean>;
  onUnheartRecording?: (id: number) => Promise<boolean>;
  onDeleteLocalRecording?: (recording: Recording) => void;
  userId?: string;
  isLoading?: boolean;
}

interface RecordingItemProps {
  recording: Recording;
  index: number;
  isPlaying: boolean;
  onStop: () => void;
  onMakePublic?: (recording: Recording, title: string) => Promise<boolean>;
  onDelete?: (recording: Recording) => void;
}

interface CloudRecordingItemProps {
  recording: RecordingData;
  onDelete?: (id: number) => Promise<boolean>;
  onHeart?: (id: number) => Promise<boolean>;
  onUnheart?: (id: number) => Promise<boolean>;
  isHearted?: boolean;
  userId?: string;
}

function RecordingItem({ recording, index, onMakePublic, onDelete }: RecordingItemProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMakingPublic] = useState(false); // keep for Dialog button disabled logic
  const [publicTitle, setPublicTitle] = useState('');
  const [showMakePublicDialog, setShowMakePublicDialog] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function play() {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      setHasEnded(false);
      
      // Start synchronized visual playback on piano keys
      if (typeof window !== 'undefined' && window.startSynchronizedPlayback && recording.events && recording.events.length > 0) {
        window.startSynchronizedPlayback(recording, audioRef.current);
      }
    }
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    
    // Stop visual playback on piano keys
    if (typeof window !== 'undefined' && window.stopPlaybackWithVisualization) {
      window.stopPlaybackWithVisualization();
    }
  }

  // Draw waveform and progress
  const drawWaveformWithProgress = (progress = 0) => {
    const canvas = canvasRef.current;
    const data = waveformDataRef.current;
    if (!canvas) return;
    
    drawWaveform({
      canvas,
      data,
      progress: duration > 0 ? progress : 0,
      options: {
        width: 500,
        height: 60,
        waveformColor: 'rgba(47, 64, 255, 0.7)',
        progressColor: 'rgba(59, 130, 246, 0.3)',
        progressLineColor: '#3b82f6',
        centerLineColor: 'rgba(137, 137, 137, 0.5)',
      }
    });
  };

  // Fetch and decode waveform once
  useEffect(() => {
    const audioUrl = recording.mp3Url || recording.audioUrl;
    if (!audioUrl) return;
    
    createWaveformData(audioUrl)
      .then(data => {
        waveformDataRef.current = data;
        drawWaveformWithProgress(0);
      })
      .catch(() => {
        waveformDataRef.current = null;
        drawWaveformWithProgress(0);
      });
    // eslint-disable-next-line
  }, [recording.audioUrl, recording.mp3Url]);

  // Redraw on progress
  useEffect(() => {
    drawWaveformWithProgress(duration > 0 ? currentTime / duration : 0);
    // eslint-disable-next-line
  }, [currentTime, duration, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setIsPlaying(false);
      setHasEnded(true);
      setCurrentTime(0);
      drawWaveformWithProgress(0);
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
  }, []);


  const durationText = duration > 0 ? formatDuration(duration) : (recording.events && recording.events.length > 0 ? formatDuration(recording.events[recording.events.length - 1].time / 1000) : '0:00');

  // Safely handle timestamp with fallback
  const timestamp = recording.timestamp instanceof Date ? 
    recording.timestamp : 
    (recording.timestamp ? new Date(recording.timestamp) : new Date());

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 ">
      <CardContent >
        <div className="flex items-center gap-4">
          {/* Play/Stop button */}
          <Button
            size="icon"
            variant={"outline"}
            onClick={isPlaying ?  stop : play}
            className="flex-shrink-0 h-12 w-12 rounded-full"
          >
            {isPlaying && !hasEnded ? (
              <Square className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          {/* Recording info */}
          <div className="flex-grow min-w-0 flex flex-col items-start">
            <div className="flex items-center gap-2">
              <h1 className="text-md font-semibold truncate">
                Recording #{index + 1}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                Private
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <span title={formatExactDate(timestamp)}>{timeAgo(timestamp)}</span>
              </div>
            </div>
          </div>
          
          {onMakePublic && (
                <Dialog open={showMakePublicDialog} onOpenChange={setShowMakePublicDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        setShowMakePublicDialog(true);
                        setUploadError(null);
                      }}
            
                    >
                      <GlobeIcon className="w-4 h-4 mr-1" />
                      Make Public
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Make Public</DialogTitle>
                      <DialogDescription>
                        Pick a title for your recording and release it to the world.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        type="text"
                        placeholder="Enter recording title..."
                        value={publicTitle}
                        onChange={(e) => setPublicTitle(e.target.value)}
                      />
                      {uploadError && (
                        <div className="text-sm text-red-500">
                          {uploadError}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setShowMakePublicDialog(false)}>
                        Hmm, not yet
                      </Button>
                      <Button 
                        onClick={() => onMakePublic && publicTitle.trim() && onMakePublic(recording, publicTitle.trim())}
                        disabled={!publicTitle.trim() || isMakingPublic}
                      >
                        {isMakingPublic ? 'Making Public...' : "Let's do this"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
                 {onDelete && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onDelete(recording)}
                  className="text-gray-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
          {/* Audio waveform, playback, download */}
          <div className="flex-shrink-0 flex flex-row items-center gap-2">
            <div className="relative">
            <canvas
              ref={canvasRef}
              width={500}
              height={60}
              className=" rounded-md shadow-inner border border-border "
            />
            <div className="absolute bottom-1 right-1 flex items-center gap-2 text-muted-foreground  text-xs px-1 py-1 rounded-md">{durationText}</div>
            </div>
            <div className="flex gap-2 items-end justify-end flex-col">
              {recording.mp3Url ? (
                <>
                  <audio ref={audioRef} src={recording.mp3Url} controls className="hidden" />
                  <a href={recording.mp3Url} download={`recording-${index + 1}.wav`}>
                    <Button
                      size="sm"
                      variant="outline"
                    >
                      Audio
                      <Download className="w-4 h-4 ml-1" />
                    </Button>
                  </a>
                </>
              ) : recording.audioUrl ? (
                <>
                  <audio ref={audioRef} src={recording.audioUrl} controls className="hidden" />
                  <a href={recording.audioUrl} download={`recording-${index + 1}.webm`} target="_blank">
                    <Button
                      size="sm"
                      variant="outline"
                    >
                      Audio
                      <Download className="w-4 h-4 ml-1" />
                    </Button>
                  </a>
                </>
              ) : null}
              {recording.midiUrl && (
                <a href={recording.midiUrl} download={`recording-${index + 1}.mid`} target="_blank">
                  <Button 
                    variant="outline" 
                    size="sm"
                  >
                    MIDI
                    <Download className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              )}
              
            
              
             
            </div>
              {/* Make Public and Delete buttons */}
            
            
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CloudRecordingItem({ recording, onDelete, onHeart, onUnheart, isHearted, userId }: CloudRecordingItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCopying, setIsCopying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);

  const isOwnRecording = userId && recording.created_by === userId;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete || !recording.id) return;
    setIsDeleting(true);
    try {
      await onDelete(recording.id);
    } catch (error) {
      console.error('Error deleting recording:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHeart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onHeart || !recording.id) return;
    try {
      await onHeart(recording.id);
    } catch (error) {
      console.error('Error hearting recording:', error);
    }
  };

  const handleUnheart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUnheart || !recording.id) return;
    try {
      await onUnheart(recording.id);
    } catch (error) {
      console.error('Error unhearting recording:', error);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!recording.id) return;
    
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
  
  const play = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      setHasEnded(false);
      
      // For cloud recordings, we don't have events data in the API response
      // Visual playback will only work for local recordings that have events
      // TODO: If needed, we could fetch the MIDI file and decode it for visualization
    }
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    
    // Stop visual playback on piano keys
    if (typeof window !== 'undefined' && window.stopPlaybackWithVisualization) {
      window.stopPlaybackWithVisualization();
    }
  };

  // Draw waveform and progress
  const drawWaveformWithProgress = (progress = 0) => {
    const canvas = canvasRef.current;
    const data = waveformDataRef.current;
    if (!canvas) return;
    
    drawWaveform({
      canvas,
      data,
      progress: duration > 0 ? progress : 0,
      options: {
        width: 500,
        height: 60,
        waveformColor: 'rgba(47, 64, 255, 0.7)',
        progressColor: 'rgba(59, 130, 246, 0.3)',
        progressLineColor: '#3b82f6',
        centerLineColor: 'rgba(137, 137, 137, 0.5)',
      }
    });
  };
  // Fetch and decode waveform once
  useEffect(() => {
    const audioUrl = recording.audio;
    if (!audioUrl) return;
    
    createWaveformData(audioUrl)
      .then(data => {
        waveformDataRef.current = data;
        drawWaveformWithProgress(0);
      })
      .catch(() => {
        waveformDataRef.current = null;
        drawWaveformWithProgress(0);
      });
    // eslint-disable-next-line
  }, [recording.audio]);
  // Redraw on progress
  useEffect(() => {
    const storedDuration = recording.duration || 0;
    const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
    const finalDuration = storedDuration > 0 ? storedDuration : audioDuration;
    drawWaveformWithProgress(finalDuration > 0 ? currentTime / finalDuration : 0);
    // eslint-disable-next-line
  }, [currentTime, duration, isPlaying, recording.duration]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setIsPlaying(false);
      setHasEnded(true);
      setCurrentTime(0);
      drawWaveformWithProgress(0);
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
  }, []);

  // Use stored duration from database, fallback to audio element duration, then to 0
  const storedDuration = recording.duration || 0;
  const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const finalDuration = storedDuration > 0 ? storedDuration : audioDuration;
  const durationText = finalDuration > 0 ? formatDuration(finalDuration) : '0:00';

  // Safely handle timestamp with fallback
  const timestamp = recording.created_at ? new Date(recording.created_at) : new Date();

  return (
    <Link to={`/recording/${recording.id}`} className="block">
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer`}>
        <CardContent >
          <div className="flex items-center gap-4">
          {/* Play/Stop button */}
          <Button
            size="icon"
            variant={ "outline"}
            onClick={isPlaying ? stop : play}
            className="flex-shrink-0 h-12 w-12 rounded-full"
            disabled={!recording.audio}
          >
            {isPlaying && !hasEnded ? (
              <Square className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          {/* Recording info */}
          <div className="flex-grow min-w-0 flex flex-col items-start">
            <div className="flex items-center gap-2">
              <h1 className="text-md font-semibold truncate">
                {recording.title}
              </h1>
              {isOwnRecording && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                  Me
                </span>
              )}
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  Public
                </span>
             
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">

              <div className="flex items-center gap-1">
                <span title={formatExactDate(timestamp)}>{timeAgo(timestamp)}</span>
                <span>by {isOwnRecording ? 'me' : 'someone'} from {getCountryFlag(recording.country)}</span>
                <span>{recording.country}</span>
              </div>
            </div>
          </div>
          {isOwnRecording && onDelete && recording.id && (
            <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-gray-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="h-1 w-1 bg-gray-500 rounded-full" />
                </>
              )}
          <div className="flex items-center gap-1">
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
            {onHeart && recording.id && (
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
               
          {/* Audio waveform and controls */}
          <div className="flex-shrink-0 flex flex-row items-center gap-2">
            <div className="relative">
            <canvas
              ref={canvasRef}
              width={500}
              height={60}
              className=" rounded-md shadow-inner border border-border "
            />
            <div className="absolute bottom-1 right-1 flex items-center gap-2 text-muted-foreground  text-xs px-1 py-1 rounded-md">{durationText}</div>
            </div>
            <div className="flex gap-2 items-end justify-end flex-col">
              {recording.audio && (
                <>
                  <audio ref={audioRef} src={recording.audio} controls className="hidden" />
                  <a href={recording.audio} download={`${recording.title}.wav`} target="_blank" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline">
                      Audio
                      <Download className="w-4 h-4 ml-1" />
                    </Button>
                  </a>
                </>
              )}
              {recording.midi && (
                <a href={recording.midi} download={`${recording.title}.mid`} target="_blank" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline">
                    MIDI
                    <Download className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              )}
              
             
            </div>

         
                    
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

export function RecordingsList({ 
  recordings, 
  cloudRecordings, 
  onStopPlayback, 
  isSoundOn, 
  onUploadToCloud, 
  onDeleteCloudRecording,
  onHeartRecording,
  onUnheartRecording,
  onDeleteLocalRecording,
  userId,
  isLoading 
}: RecordingsListProps) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const handleStop = () => {
    onStopPlayback();
    setPlayingIndex(null);
  };

  const handleMakePublic = async (recording: Recording, title: string): Promise<boolean> => {
    if (!onUploadToCloud) return false;
    return await onUploadToCloud(title, recording);
  };

  const handleDeleteLocal = (recording: Recording) => {
    if (onDeleteLocalRecording) {
      onDeleteLocalRecording(recording);
    }
  };

  // Filter recordings based on active tab
  const filteredCloudRecordings = activeTab === 'Me' 
    ? cloudRecordings.filter(recording => recording.created_by === userId)
    : cloudRecordings;



  const hasLocalRecordings = recordings.length > 0;
  const hasCloudRecordings = cloudRecordings.length > 0;

  if (!hasLocalRecordings && !hasCloudRecordings && isSoundOn) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
        <Card className="">
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground space-y-2">
              No recordings yet
              <p className="text-xs mt-2">Press <Mic className="h-4 w-4 inline-block" /> to record </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-4/5 mx-auto mt-8 space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-1/4 grid-cols-2 mb-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            All
          </TabsTrigger>
          <TabsTrigger value="Me" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Me
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Local recordings first */}
          {recordings.map((recording, index, array) => (
            <RecordingItem
              key={`recording-${index}-${recording.startedAt || recording.timestamp?.getTime() || Date.now()}`}
              recording={recording}
              index={array.length - index - 1}
              isPlaying={playingIndex === index}
              onStop={handleStop}
              onMakePublic={handleMakePublic}
              onDelete={handleDeleteLocal}
            />
          ))}
          
          {/* All cloud recordings */}
          {cloudRecordings.map((recording, index) => (
                          <CloudRecordingItem
                key={`cloud-recording-${recording.id || index}`}
                recording={recording}
                onDelete={onDeleteCloudRecording}
                onHeart={onHeartRecording}
                onUnheart={onUnheartRecording}
                isHearted={userId ? recording.hearts?.includes(userId) || false : false}
                userId={userId}
              />
          ))}
        </TabsContent>

        <TabsContent value="Me" className="space-y-4">
          {/* Local recordings first */}
          {recordings.map((recording, index, array) => (
            <RecordingItem
              key={`recording-${index}-${recording.startedAt || recording.timestamp?.getTime() || Date.now()}`}
              recording={recording}
              index={array.length - index - 1}
              isPlaying={playingIndex === index}
              onStop={handleStop}
              onMakePublic={handleMakePublic}
              onDelete={handleDeleteLocal}
            />
          ))}
          
          {/* Only my cloud recordings */}
          {filteredCloudRecordings.map((recording, index) => (
            <CloudRecordingItem
              key={`cloud-recording-${recording.id || index}`}
              recording={recording}
              onDelete={onDeleteCloudRecording}
              onHeart={onHeartRecording}
              onUnheart={onUnheartRecording}
              isHearted={userId ? recording.hearts?.includes(userId) || false : false}
              userId={userId}
            />
          ))}
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="text-center py-4">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      )}
    </div>
  );
}

// Extend window type for global functions
declare global {
  interface Window {
    startSynchronizedPlayback?: (recording: Recording, audioElement: HTMLAudioElement) => void;
    stopPlaybackWithVisualization?: () => void;
  }
}