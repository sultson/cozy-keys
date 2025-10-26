import { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import type { RecordingData } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play, Square, Mic, Download, Trash2, Globe as GlobeIcon, Users, User, Heart, Link as LinkIcon, Pen } from 'lucide-react';
import { getCountryFlag } from '../utils/countryFlags';
import { timeAgo, formatExactDate } from '../utils/timeAgo';
import { drawWaveform, createWaveformData, setupCanvas } from '../utils/drawWaveform';
import { formatDuration } from '../utils/formatDuration';
import { 
  toggleRecordingPublic, 
  updateRecordingTitle, 
  deleteRecording as deleteRecordingApi, 
  heartRecording as heartRecordingApi, 
  unheartRecording as unheartRecordingApi
} from '../lib/api';

interface RecordingsListProps {
  recordings: RecordingData[];
  isSoundOn: boolean;
  userId?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  hasMoreRecordings?: boolean;
  isLoadingMore?: boolean;
}

interface RecordingItemProps {
  recording: RecordingData;
  userId?: string;
  onRefresh?: () => void;
  onEditTitle?: (recording: RecordingData) => void;
}

function RecordingItem({ recording, userId, onRefresh, onEditTitle }: RecordingItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCopying, setIsCopying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const canvasDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  const isOwnRecording = userId && recording.created_by === userId;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recording.id) return;
    setIsDeleting(true);
    try {
      await deleteRecordingApi(recording.id);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting recording:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHeart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recording.id) return;
    try {
      await heartRecordingApi(recording.id);
      onRefresh?.();
    } catch (error) {
      console.error('Error hearting recording:', error);
    }
  };

  const handleUnheart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!recording.id) return;
    try {
      await unheartRecordingApi(recording.id);
      onRefresh?.();
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

  const handleTogglePublic = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!toggleRecordingPublic || !recording.id) return;
    try {
      await toggleRecordingPublic(recording.id);
      onRefresh?.();
    } catch (error) {
      console.error('Error toggling recording public status:', error);
    }
  };

  const handleEditTitle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEditTitle?.(recording);
  };
  
  const play = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (audioRef.current && recording.id) {
      audioRef.current.play();
      setIsPlaying(true);
      setHasEnded(false);
      
      // Start synchronized visual playback on piano keys
      if (typeof window !== 'undefined' && window.startSynchronizedPlayback) {
        window.startSynchronizedPlayback(recording.id, audioRef.current);
      }
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

  // Update canvas dimensions when needed
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasWidth = Math.floor(rect.width);
    const canvasHeight = 60;

    canvasDimensionsRef.current = { width: canvasWidth, height: canvasHeight };
    setupCanvas(canvas, canvasWidth, canvasHeight);
  }, []);

  // Draw waveform and progress
  const drawWaveformWithProgress = useCallback((progress = 0) => {
    const canvas = canvasRef.current;
    const data = waveformDataRef.current;
    const dimensions = canvasDimensionsRef.current;
    if (!canvas || !dimensions) return;

    drawWaveform({
      canvas,
      data,
      progress: duration > 0 ? progress : 0,
      options: {
        width: dimensions.width,
        height: dimensions.height,
        waveformColor: 'rgba(47, 64, 255, 0.7)',
        progressColor: 'rgba(59, 130, 246, 0.3)',
        progressLineColor: '#3b82f6',
        centerLineColor: 'rgba(137, 137, 137, 0.5)',
      }
    });
  }, [duration]);

  // Initialize canvas dimensions when component mounts and canvas is available
  useLayoutEffect(() => {
    if (canvasRef.current && !canvasDimensionsRef.current) {
      updateCanvasDimensions();
    }
  }, [updateCanvasDimensions]);

  // Fetch and decode waveform once
  useEffect(() => {
    const audioUrl = recording.audio;
    if (!audioUrl) return;

    createWaveformData(audioUrl)
      .then(data => {
        waveformDataRef.current = data;
        // Defer canvas dimension calculation until after layout is complete
        requestAnimationFrame(() => {
          updateCanvasDimensions();
          drawWaveformWithProgress(0);
        });
      })
      .catch(() => {
        waveformDataRef.current = null;
        // Defer canvas dimension calculation until after layout is complete
        requestAnimationFrame(() => {
          updateCanvasDimensions();
          drawWaveformWithProgress(0);
        });
      });
    // eslint-disable-next-line
  }, [recording.audio]);

  // Handle window resize for responsive waveform
  useEffect(() => {
    const handleResize = () => {
      if (waveformDataRef.current) {
        requestAnimationFrame(() => {
          updateCanvasDimensions();
          drawWaveformWithProgress(currentTime / (duration > 0 ? duration : 1));
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentTime, duration, drawWaveformWithProgress, updateCanvasDimensions]);

  // Redraw on progress
  useEffect(() => {
    const storedDuration = recording.duration || 0;
    const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
    const finalDuration = storedDuration > 0 ? storedDuration : audioDuration;
    drawWaveformWithProgress(finalDuration > 0 ? currentTime / finalDuration : 0);
  }, [currentTime, duration, isPlaying, recording.duration, drawWaveformWithProgress]);

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
  }, [drawWaveformWithProgress]);

  // Use stored duration from database, fallback to audio element duration, then to 0
  const storedDuration = recording.duration || 0;
  const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
  const finalDuration = storedDuration > 0 ? storedDuration : audioDuration;
  const durationText = finalDuration > 0 ? formatDuration(finalDuration) : '0:00';

  // Safely handle timestamp with fallback
  const timestamp = recording.created_at ? new Date(recording.created_at) : new Date();

  return (
    <Link to={`/recording/${recording.id}`} className="block">
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-102`}>
        <CardContent className="p-4 md:p-6">
          {/* Desktop: Single row layout, Mobile: Stacked layout */}
          <div className="flex flex-col gap-4 md:gap-4">
            {/* Mobile layout - stacked */}
            <div className="flex md:hidden flex-col gap-4">
              {/* Mobile: Top row - Play button + Title */}
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={isPlaying ? stop : play}
                  className="flex-shrink-0 h-10 w-10 rounded-full"
                  disabled={!recording.audio}
                >
                  {isPlaying && !hasEnded ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </Button>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-sm font-semibold truncate max-w-full">
                      {recording.title}
                    </h1>
                    {isOwnRecording && onEditTitle && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleEditTitle}
                        className="flex-shrink-0 h-6 w-6 text-gray-500"
                        title="Edit title"
                      >
                        <Pen className="size-3" />
                      </Button>
                    )}
                    {isOwnRecording && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                        Me
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${recording.is_public ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
                      {recording.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile: Metadata row */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span title={formatExactDate(timestamp)}>{timeAgo(timestamp)}</span>
                <span>by {isOwnRecording ? 'me' : 'someone'} from {getCountryFlag(recording.country)}</span>
                <span>{recording.country}</span>
              </div>

              {/* Mobile: Action buttons row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {isOwnRecording && recording.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleTogglePublic}
                      className={`flex-shrink-0 h-8 w-8 rounded-full text-gray-500 hover:text-blue-500 ${recording.is_public ? 'text-blue-500' : 'text-gray-500'}`}
                      title={recording.is_public ? 'Make Private' : 'Make Public'}
                    >
                      <GlobeIcon className="h-4 w-4" />
                    </Button>
                  )}

                  {isOwnRecording && recording.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-shrink-0 h-8 w-8 text-gray-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyLink}
                    disabled={isCopying}
                    className="flex-shrink-0 h-8 w-8 rounded-full text-gray-500 hover:text-blue-500 relative"
                    title="Copy link to clipboard"
                  >
                    {isCopying ? (
                      <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                  </Button>

                  {recording.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={recording.hearts?.includes(userId || '') ? handleUnheart : handleHeart}
                      className={`flex-shrink-0 h-8 w-8 rounded-full ${recording.hearts?.includes(userId || '') ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 relative`}
                      title={recording.hearts?.includes(userId || '') ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className="h-4 w-4" />
                      {recording.hearts && recording.hearts.length > 0 && (
                        <div className="text-xs text-muted-foreground absolute bottom-0 rounded-full w-full">
                          <span>{recording.hearts.length}</span>
                        </div>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop layout - single row */}
            <div className="hidden md:flex items-center gap-4">
              {/* Play/Stop button */}
              <Button
                size="icon"
                variant="outline"
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

              {/* Recording info - takes available space */}
              <div className="flex-grow min-w-0 flex flex-col items-start">
                <div className="flex items-center gap-2">
                  <h1 className="text-md font-semibold truncate max-w-full">
                    {recording.title}
                  </h1>
                  {isOwnRecording && onEditTitle && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleEditTitle}
                      className="flex-shrink-0 h-6 w-6 text-gray-500"
                      title="Edit title"
                    >
                      <Pen className="size-3" />
                    </Button>
                  )}
                  {isOwnRecording && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      Me
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${recording.is_public ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
                    {recording.is_public ? 'Public' : 'Private'}
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

              {/* Action buttons - desktop */}
              <div className="flex items-center gap-1">
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

                {isOwnRecording && recording.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-shrink-0 h-10 w-10 text-gray-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

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

                {recording.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={recording.hearts?.includes(userId || '') ? handleUnheart : handleHeart}
                    className={`flex-shrink-0 h-10 w-10 rounded-full ${recording.hearts?.includes(userId || '') ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 relative`}
                    title={recording.hearts?.includes(userId || '') ? 'Remove from favorites' : 'Add to favorites'}
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

            {/* Audio waveform and controls - shared between mobile and desktop */}
            <div className="w-full flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-2">
              <div className="relative flex-1 w-full md:w-auto">
                <canvas
                  ref={canvasRef}
                  className="w-full max-w-sm md:max-w-none rounded-md shadow-inner border border-border"
                />
                <div className="absolute bottom-1 right-1 flex items-center gap-2 text-muted-foreground text-xs px-1 py-1 rounded-md bg-background/80">
                  {durationText}
                </div>
              </div>
              <div className="flex gap-2 items-start md:items-end justify-start md:justify-end flex-row md:flex-col w-full md:w-auto">
                {recording.audio && (
                  <>
                    <audio ref={audioRef} src={recording.audio} controls className="hidden" />
                    <a href={recording.audio} download={`${recording.title}.wav`} target="_blank" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="flex-1 md:flex-none">
                        <Download className="w-4 h-4 mr-1 md:mr-1 md:ml-0" />
                        Audio
                      </Button>
                    </a>
                  </>
                )}
                {recording.midi && (
                  <a href={recording.midi} download={`${recording.title}.mid`} target="_blank" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1 md:flex-none">
                      <Download className="w-4 h-4 mr-1 md:mr-1 md:ml-0" />
                      MIDI
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
  isSoundOn, 
  userId,
  isLoading,
  onRefresh,
  onLoadMore,
  hasMoreRecordings = false,
  isLoadingMore = false
}: RecordingsListProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecording, setEditingRecording] = useState<RecordingData | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Filter recordings based on active tab
  const filteredRecordings = activeTab === 'Me' 
    ? recordings.filter(recording => recording.created_by === userId)
    : recordings;

  const hasRecordings = recordings.length > 0;

  const handleEditTitle = (recording: RecordingData) => {
    setEditingRecording(recording);
    setNewTitle(recording.title);
    setShowEditDialog(true);
  };

  const handleSaveTitle = async () => {
    if (!editingRecording?.id || !newTitle.trim()) return;
    
    setIsEditingTitle(true);
    try {
      const success = await updateRecordingTitle(editingRecording.id, newTitle.trim());
      if (success) {
        setShowEditDialog(false);
        setEditingRecording(null);
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error updating recording title:', error);
    } finally {
      setIsEditingTitle(false);
    }
  };

  if (!hasRecordings && isSoundOn) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-4 md:mt-8 px-4 md:px-0">
        <Card className="">
          <CardContent className="p-6 md:p-8 text-center">
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
    <div className="w-full max-w-6xl mx-auto mt-4 md:mt-8 px-4 md:px-0 space-y-4 md:space-y-6">
      {/* Edit Title Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recording Title</DialogTitle>
            <DialogDescription>
              Update the title of your recording.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter new title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTitle}
              disabled={!newTitle.trim() || isEditingTitle}
            >
              {isEditingTitle ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-1/4 grid-cols-2 mb-4">
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
          {recordings.map((recording, index) => (
            <RecordingItem
              key={`recording-${recording.id || index}`}
              recording={recording}
              userId={userId}
              onRefresh={onRefresh}
              onEditTitle={handleEditTitle}
            />
          ))}
          
          {/* Show older recordings button */}
          {hasMoreRecordings && onLoadMore && (
            <div className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="px-8"
              >
                {isLoadingMore ? 'Loading...' : 'Show older recordings'}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="Me" className="space-y-4">
          {filteredRecordings.map((recording, index) => (
            <RecordingItem
              key={`recording-${recording.id || index}`}
              recording={recording}
              userId={userId}
              onRefresh={onRefresh}
              onEditTitle={handleEditTitle}
            />
          ))}
          
          {/* Show older recordings button (for "Me" tab) */}
          {hasMoreRecordings && onLoadMore && (
            <div className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="px-8"
              >
                {isLoadingMore ? 'Loading...' : 'Show older recordings'}
              </Button>
            </div>
          )}
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
    stopPlaybackWithVisualization?: () => void;
  }
}