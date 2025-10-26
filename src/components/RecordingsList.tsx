import { useRef, useEffect, useState, useCallback } from 'react';
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
import { drawWaveform, createWaveformData } from '../utils/drawWaveform';
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

  // Draw waveform and progress
  const drawWaveformWithProgress = useCallback((progress = 0) => {
    const canvas = canvasRef.current;
    const data = waveformDataRef.current;
    if (!canvas) return;

    // Get the actual canvas width for responsiveness
    const canvasWidth = canvas.clientWidth || 500;

    drawWaveform({
      canvas,
      data,
      progress: duration > 0 ? progress : 0,
      options: {
        width: canvasWidth,
        height: 60,
        waveformColor: 'rgba(47, 64, 255, 0.7)',
        progressColor: 'rgba(59, 130, 246, 0.3)',
        progressLineColor: '#3b82f6',
        centerLineColor: 'rgba(137, 137, 137, 0.5)',
      }
    });
  }, [duration]);

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

  // Handle canvas resizing for responsiveness
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && waveformDataRef.current) {
        const canvasWidth = canvas.clientWidth || 500;
        canvas.width = canvasWidth;
        drawWaveformWithProgress(currentTime / (duration > 0 ? duration : 1));
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial setup
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [currentTime, duration, drawWaveformWithProgress]);

  // Redraw on progress
  useEffect(() => {
    const storedDuration = recording.duration || 0;
    const audioDuration = duration > 0 && isFinite(duration) ? duration : 0;
    const finalDuration = storedDuration > 0 ? storedDuration : audioDuration;
    drawWaveformWithProgress(finalDuration > 0 ? currentTime / finalDuration : 0);
    // eslint-disable-next-line
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
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-102`}>
        <CardContent >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                {isOwnRecording && onEditTitle && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleEditTitle}
                  className=" text-gray-500"
                  title="Edit title"
                >
                  <Pen className="size-3" />
                </Button>
              )}
              </h1>
              {/* Edit Title Button (only for own recordings) */}

              {isOwnRecording && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                  Me
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${recording.is_public ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
                {recording.is_public ? 'Public' : 'Private'}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs text-gray-400">
              <span title={formatExactDate(timestamp)}>{timeAgo(timestamp)}</span>
              <span>by {isOwnRecording ? 'me' : 'someone'}</span>
              <span className="flex items-center gap-1">
                {getCountryFlag(recording.country)}
                <span>{recording.country}</span>
              </span>
            </div>
          </div>

          {/* Action buttons */}
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
                className="text-gray-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            <div className="w-4"/>

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

          {/* Audio waveform and controls */}
          <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
            <canvas
              ref={canvasRef}
              width={500}
              height={60}
              className="w-full rounded-md shadow-inner border border-border "
            />
            <div className="absolute bottom-1 right-1 flex items-center gap-2 text-muted-foreground  text-xs px-1 py-1 rounded-md">{durationText}</div>
            </div>
            <div className="flex flex-row gap-2 items-center justify-center sm:flex-col sm:items-end sm:justify-end">
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
    <div className="w-full sm:w-4/5 mx-auto mt-8 space-y-6">
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
        <TabsList className="grid w-full sm:w-1/4 grid-cols-2 mb-4">
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