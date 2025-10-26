import type { Environment } from '@/hooks/useSound';
import type { RecordingEvent } from '@/hooks/useRecording';
import { useEffect, useRef, useCallback } from 'react';

interface PianoProps {
  playNote: (note: number, velocity?: number) => void;
  stopNote: (note: number) => void;
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
  onMidiStatusChange?: (status: string, connected: boolean) => void;
  isSoundOn?: boolean;
  environment: Environment;
}

interface KeyAnimation {
  progress: number;
  target: number;
}

export function Piano({
  playNote,
  stopNote,
  onNoteOn,
  onNoteOff,
  onMidiStatusChange,
  isSoundOn = true,
  environment
}: PianoProps) {
  // Refs for layered canvases
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeKeysCanvasRef = useRef<HTMLCanvasElement>(null);
  const mechanicsCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const activeNotesRef = useRef<Set<number>>(new Set());
  const playbackNotesRef = useRef<Set<number>>(new Set());
  const playbackEventsRef = useRef<RecordingEvent[]>([]);
  const playbackEventIndexRef = useRef(0);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTimeRef = useRef(0);
  const playbackRequestIdRef = useRef(0);
  const keyAnimationsRef = useRef<Map<number, KeyAnimation>>(new Map());
  const animationIdRef = useRef<number | null>(null);
  const pointerDownRef = useRef<boolean>(false);
  const pointerNoteRef = useRef<number | null>(null);
  const isMidiConnectedRef = useRef<boolean>(false);

  // Piano dimensions - unchanged
  const whiteKeys = 52;
  const keyWidth = 1400 / whiteKeys;
  const keyHeight = 200;
  const mechanicsHeight = 100;

  const isBlack = useCallback((note: number): boolean => {
    return [1, 3, 6, 8, 10].includes(note % 12);
  }, []);

  const getEnvironmentColors = useCallback(() => {
    switch (environment) {
      case 'nature':
        return {
          stringBg: ['#2d5016', '#1a2e0e'],
          blackStrings: '#4a7c59',
          whiteStrings: '#6b8e7a',
          pressedGlow: '#22c55e',
          pressedKey: '#16a34a',
        };
      case 'cosmic':
        return {
          stringBg: ['#1e1b4b', '#0f0f23'],
          blackStrings: '#6366f1',
          whiteStrings: '#8b5cf6',
          pressedGlow: '#06b6d4',
          pressedKey: '#0891b2',
        };
      default:
        return {
          stringBg: ['#2d3748', '#1a202c'],
          blackStrings: '#4a5568',
          whiteStrings: '#718096',
          pressedGlow: '#60a5fa',
          pressedKey: '#3b82f6',
        };
    }
  }, [environment]);

  const drawKey3D = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isPressed: boolean, isBlackKey: boolean = false, isPlayback: boolean = false) => {
    const depth = isBlackKey ? 6 : 10;
    const pressDepth = isPressed ? depth * 0.6 : depth;
    const perspectiveRatio = 0.85;
    const topY = y + height * 0.15;
    const topWidth = width * perspectiveRatio;
    const topX = x + (width - topWidth) / 2;
    
    ctx.save();
    
    const colors = getEnvironmentColors();
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    const shadowY = y + height * 0.05 + (isPressed ? 1 : 2);
    ctx.fillRect(x + 1, shadowY, width, height * 0.95);
    
    // Main key face
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    if (isBlackKey) {
      if (isPressed) {
        if (isPlayback) {
          gradient.addColorStop(0, '#9ca3af');
          gradient.addColorStop(0.5, '#6b7280');
          gradient.addColorStop(1, '#4b5563');
        } else {
          gradient.addColorStop(0, colors.pressedGlow);
          gradient.addColorStop(0.5, colors.pressedKey);
          gradient.addColorStop(1, colors.pressedKey);
        }
      } else {
        gradient.addColorStop(0, '#475569');
        gradient.addColorStop(0.5, '#374151');
        gradient.addColorStop(1, '#1f2937');
      }
    } else {
      if (isPressed) {
        if (isPlayback) {
          gradient.addColorStop(0, '#e5e7eb');
          gradient.addColorStop(0.5, '#d1d5db');
          gradient.addColorStop(1, '#9ca3af');
        } else {
          if (environment === 'nature') {
            gradient.addColorStop(0, '#dcfce7');
            gradient.addColorStop(0.5, '#bbf7d0');
            gradient.addColorStop(1, '#22c55e');
          } else if (environment === 'cosmic') {
            gradient.addColorStop(0, '#e0e7ff');
            gradient.addColorStop(0.5, '#c7d2fe');
            gradient.addColorStop(1, '#6366f1');
          } else {
            gradient.addColorStop(0, '#fef3c7');
            gradient.addColorStop(0.5, '#fde68a');
            gradient.addColorStop(1, '#f59e0b');
          }
        }
      } else {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#f9fafb');
        gradient.addColorStop(1, '#f3f4f6');
      }
    }
    ctx.fillStyle = gradient;
    
    // Trapezoid shape
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + topWidth, topY);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    
    // Glow
    if (isPressed) {
      const glowColor = isBlackKey ? colors.pressedGlow : 
        (environment === 'nature' ? '#22c55e' : 
         environment === 'cosmic' ? '#6366f1' : '#f59e0b');
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
    ctx.save();

    // Top surface
    ctx.filter = 'blur(1px)';
    const topGradient = ctx.createLinearGradient(topX, topY, topX, topY + pressDepth);
    if (isBlackKey) {
        topGradient.addColorStop(0, isPressed ? colors.pressedGlow : '#94a3b8');
        topGradient.addColorStop(1, isPressed ? colors.pressedKey : '#6b7280');
    } else {
        if (isPressed) {
            if (environment === 'nature') {
                topGradient.addColorStop(0, '#dcfce7');
                topGradient.addColorStop(1, '#22c55e');
            } else if (environment === 'cosmic') {
                topGradient.addColorStop(0, '#e0e7ff');
                topGradient.addColorStop(1, '#6366f1');
            } else {
                topGradient.addColorStop(0, '#fef3c7');
                topGradient.addColorStop(1, '#fde68a');
            }
        } else {
            topGradient.addColorStop(0, '#ffffff');
            topGradient.addColorStop(1, '#f1f5f9');
        }
    }
    ctx.fillStyle = topGradient;
    ctx.fillRect(topX, topY - pressDepth, topWidth, pressDepth);
    ctx.filter = 'none';
    
    // Right edge
    const rightGradient = ctx.createLinearGradient(x + width - 2, y, x + width, y);
    if (isBlackKey) {
        rightGradient.addColorStop(0, isPressed ? colors.pressedKey : '#6b7280');
        rightGradient.addColorStop(1, isPressed ? colors.pressedKey : '#4b5563');
    } else {
        if (isPressed) {
            if (environment === 'nature') {
                rightGradient.addColorStop(0, '#bbf7d0');
                rightGradient.addColorStop(1, '#22c55e');
            } else if (environment === 'cosmic') {
                rightGradient.addColorStop(0, '#c7d2fe');
                rightGradient.addColorStop(1, '#6366f1');
            } else {
                rightGradient.addColorStop(0, '#fde68a');
                rightGradient.addColorStop(1, '#f59e0b');
            }
        } else {
            rightGradient.addColorStop(0, '#f8fafc');
            rightGradient.addColorStop(1, '#f1f5f9');
        }
    }
    ctx.fillStyle = rightGradient;
    ctx.beginPath();
    ctx.moveTo(topX + topWidth, topY);
    ctx.lineTo(topX + topWidth + 2, topY);
    ctx.lineTo(x + width + 2, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }, [getEnvironmentColors, environment]);

  const drawStrings = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // This function now draws only to the mechanics layer
    ctx.save();
    const colors = getEnvironmentColors();
    const stringBg = ctx.createLinearGradient(0, 0, 0, mechanicsHeight);
    stringBg.addColorStop(0, colors.stringBg[0]);
    stringBg.addColorStop(1, colors.stringBg[1]);
    ctx.fillStyle = stringBg;
    ctx.fillRect(0, 0, canvas.width, mechanicsHeight);
    
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      const isBlackKey = isBlack(i);
      const x = isBlackKey ? (whiteIndex - 1) * keyWidth + keyWidth * 0.85 : whiteIndex * keyWidth + keyWidth / 2;
      
      ctx.strokeStyle = isBlackKey ? colors.blackStrings : colors.whiteStrings;
      ctx.lineWidth = isBlackKey ? 1.2 : 0.8;
      
      const vibration = activeNotesRef.current.has(i) ? Math.sin(Date.now() * 0.015) * 0.5 : 0;
      
      ctx.beginPath();
      ctx.moveTo(x + vibration, 10);
      ctx.lineTo(x + vibration * 0.3, mechanicsHeight - 10);
      ctx.stroke();

      if (!isBlackKey) whiteIndex++;
    }
    ctx.restore();
  }, [isBlack, keyWidth, mechanicsHeight, getEnvironmentColors]);
  
  const drawHammers = useCallback((ctx: CanvasRenderingContext2D) => {
    // This function now draws only to the mechanics layer
    ctx.save();
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      const isBlackKey = isBlack(i);
      const x = isBlackKey ? (whiteIndex - 1) * keyWidth + keyWidth * 0.85 : whiteIndex * keyWidth + keyWidth / 2;
      
      const anim = keyAnimationsRef.current.get(i);
      const hammerOffset = anim ? anim.progress * 15 : 0;
      const hammerY = mechanicsHeight - 30 - hammerOffset;
      
      ctx.fillStyle = activeNotesRef.current.has(i) ? '#9ca3af' : '#6b7280';
      ctx.beginPath();
      ctx.ellipse(x, hammerY, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, hammerY + 6);
      ctx.lineTo(x - 8, hammerY + 20);
      ctx.stroke();

      if (!isBlackKey) whiteIndex++;
    }
    ctx.restore();
  }, [isBlack, keyWidth, mechanicsHeight]);

  const drawAnimatedLayers = useCallback(() => {
    const mechanicsCanvas = mechanicsCanvasRef.current;
    const activeKeysCanvas = activeKeysCanvasRef.current;
    if (!mechanicsCanvas || !activeKeysCanvas) return;

    const mechanicsCtx = mechanicsCanvas.getContext('2d');
    const activeKeysCtx = activeKeysCanvas.getContext('2d');
    if (!mechanicsCtx || !activeKeysCtx) return;

    // Clear only the dynamic layers
    mechanicsCtx.clearRect(0, 0, mechanicsCanvas.width, mechanicsCanvas.height);
    activeKeysCtx.clearRect(0, 0, activeKeysCanvas.width, activeKeysCanvas.height);

    // Redraw dynamic mechanics (hammers and strings)
    drawStrings(mechanicsCtx, mechanicsCanvas);
    drawHammers(mechanicsCtx);

    // --- START OF MODIFIED LOGIC ---

    // A set to keep track of static black keys that need to be redrawn
    // to appear on top of animating white keys.
    const staticBlackKeysToRedraw = new Set<number>();

    // First, draw all active WHITE keys. While doing so, identify any
    // adjacent black keys that need to be redrawn for correct layering.
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        const anim = keyAnimationsRef.current.get(i);
        if (anim && anim.progress > 0) {
          const x = whiteIndex * keyWidth;
          const pressOffset = anim.progress * 8;
          const isPressed = anim.progress > 0.5;
          const isPlayback = playbackNotesRef.current.has(i) && !activeNotesRef.current.has(i);
          
          drawKey3D(activeKeysCtx, x + 2, mechanicsHeight + pressOffset, keyWidth - 4, keyHeight - 4, isPressed, false, isPlayback);

          // Check neighbors and add them to the redraw set if they are black keys
          if (isBlack(i - 1)) staticBlackKeysToRedraw.add(i - 1);
          if (isBlack(i + 1)) staticBlackKeysToRedraw.add(i + 1);
        }
        whiteIndex++;
      }
    }

    // Now, draw all BLACK keys that are either animating OR need to be
    // redrawn because a neighboring white key is active.
    whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        whiteIndex++;
      } else {
        const anim = keyAnimationsRef.current.get(i);
        const isActive = anim && anim.progress > 0;
        
        if (isActive || staticBlackKeysToRedraw.has(i)) {
          const x = (whiteIndex - 1) * keyWidth + keyWidth * 0.7;
          const progress = anim ? anim.progress : 0;
          const pressOffset = progress * 6;
          
          // Determine the key's state for drawing
          const isPressed = isActive ? anim.progress > 0.5 : false;
          const isPlayback = isActive ? (playbackNotesRef.current.has(i) && !activeNotesRef.current.has(i)) : false;

          drawKey3D(activeKeysCtx, x, mechanicsHeight + pressOffset, keyWidth * 0.6, keyHeight * 0.6, isPressed, true, isPlayback);
        }
      }
    }
    // --- END OF MODIFIED LOGIC ---

  }, [drawStrings, drawHammers, drawKey3D, isBlack, keyWidth, keyHeight, mechanicsHeight]);

  // Main animation loop starter
  const animateKey = useCallback((note: number, isPressed: boolean) => {
    if (!keyAnimationsRef.current.has(note)) {
      keyAnimationsRef.current.set(note, { progress: 0, target: 0 });
    }
    const anim = keyAnimationsRef.current.get(note)!;
    anim.target = isPressed ? 1 : 0;
    
    if (!animationIdRef.current) {
      const animate = () => {
        let needsUpdate = false;
        keyAnimationsRef.current.forEach((anim) => {
          const diff = anim.target - anim.progress;
          if (Math.abs(diff) > 0.01) {
            anim.progress += diff * 0.15;
            needsUpdate = true;
          } else {
            anim.progress = anim.target;
          }
        });
        
        if (needsUpdate) {
          drawAnimatedLayers(); // Call the optimized drawing function
          animationIdRef.current = requestAnimationFrame(animate);
        } else {
          animationIdRef.current = null;
          drawAnimatedLayers(); // Final draw to ensure correct state
        }
      };
      animate();
    }
  }, [drawAnimatedLayers]);
  
  // Initial draw of the static background layer
  useEffect(() => {
    const canvas = backgroundCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient for key area
    const bgGradient = ctx.createLinearGradient(0, mechanicsHeight, 0, canvas.height);
    if (environment === 'nature') {
        bgGradient.addColorStop(0, '#f0fdf4');
        bgGradient.addColorStop(1, '#dcfce7');
    } else if (environment === 'cosmic') {
        bgGradient.addColorStop(0, '#f8fafc');
        bgGradient.addColorStop(1, '#e0e7ff');
    } else {
        bgGradient.addColorStop(0, '#f8fafc');
        bgGradient.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, mechanicsHeight, canvas.width, keyHeight);
    
    // Bottom transition gradient
    const transitionGradient = ctx.createLinearGradient(0, canvas.height - 5, 0, canvas.height);
    transitionGradient.addColorStop(0, '#94a3b8');
    transitionGradient.addColorStop(1, '#000000');
    ctx.fillStyle = transitionGradient;
    ctx.fillRect(0, canvas.height - 5, canvas.width, 40);
    
    // Draw all keys in their "up" state once
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        const x = whiteIndex * keyWidth;
        drawKey3D(ctx, x + 2, mechanicsHeight, keyWidth - 4, keyHeight - 4, false, false, false);
        whiteIndex++;
      }
    }
    whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        whiteIndex++;
      } else {
        const x = (whiteIndex - 1) * keyWidth + keyWidth * 0.7;
        drawKey3D(ctx, x, mechanicsHeight, keyWidth * 0.6, keyHeight * 0.6, false, true, false);
      }
    }
    
    // Initial draw of animated layers
    drawAnimatedLayers();
  }, [drawAnimatedLayers, drawKey3D, isBlack, keyWidth, keyHeight, mechanicsHeight, environment]);

  // All subsequent logic (MIDI, pointer events, etc.) remains largely the same
  // as it only manipulates state and calls animateKey, which now triggers the optimized render.

  const handleMIDIMessage = useCallback((message: MIDIMessageEvent) => {
    if (!message.data || message.data.length < 3) return;
    const [command, note, velocity] = Array.from(message.data);
    const isNoteOn = command === 144 && velocity > 0;
    const isNoteOff = command === 128 || (command === 144 && velocity === 0);

    if (isNoteOn) {
      activeNotesRef.current.add(note);
      animateKey(note, true);
      playNote(note, velocity);
      onNoteOn?.(note, velocity);
    } else if (isNoteOff) {
      activeNotesRef.current.delete(note);
      animateKey(note, false);
      stopNote(note);
      onNoteOff?.(note);
    }
  }, [playNote, stopNote, animateKey, onNoteOn, onNoteOff]);
  
  useEffect(() => {
    const initializeMIDI = async () => {
      if (!navigator.requestMIDIAccess) {
        onMidiStatusChange?.('Web MIDI not supported', false);
        return;
      }

      try {
        const midiAccess = await navigator.requestMIDIAccess();
        console.log('number of inputs', midiAccess.inputs.size);
        
        for (const input of midiAccess.inputs.values()) {
          console.log(`${input.name} connected`, input);
          if (!isMidiConnectedRef.current) {
            onMidiStatusChange?.('MIDI Connected', true);

            input.onmidimessage = handleMIDIMessage;
            isMidiConnectedRef.current = true;

            // Add event listener for disconnect and reconnect
            input.onstatechange = (event) => {
                console.log('MIDI state changed', event);
                if (event.port) {
                  if (event.port.state === 'disconnected') {
                    onMidiStatusChange?.('MIDI Disconnected', false);
                    isMidiConnectedRef.current = false;
                  } else if (event.port.state === 'connected') {

                    onMidiStatusChange?.('MIDI Connecting...', false);
                    isMidiConnectedRef.current = true;

                    // set timeout to 1000ms
                    setTimeout(() => {
                      onMidiStatusChange?.('MIDI Connected', true);
                    }, 1000);

                  }
                }
            };
          }
        }
      } catch {
        onMidiStatusChange?.('Could not access MIDI', false);
      }
    };

    initializeMIDI();
  }, [handleMIDIMessage, onMidiStatusChange]);

  const clearPlaybackVisualization = useCallback(() => {
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    playbackEventsRef.current = [];
    playbackEventIndexRef.current = 0;
    playbackLastTimeRef.current = 0;
    playbackNotesRef.current.forEach(note => {
      if (!activeNotesRef.current.has(note)) {
        animateKey(note, false);
      }
    });
    playbackNotesRef.current.clear();
  }, [animateKey]);


  // Expose synchronized playback functions to parent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.startSynchronizedPlayback = async (recordingId: string, audioElement: HTMLAudioElement) => {
        const requestId = playbackRequestIdRef.current + 1;
        playbackRequestIdRef.current = requestId;
        clearPlaybackVisualization();
        
        if (!audioElement) {
          console.warn('No audio element provided for synchronized playback');
          return;
        }

        try {
          const { getRecordingEvents } = await import('../lib/api');
          const { events: rawEvents, hasTempoMeta } = await getRecordingEvents(recordingId);

          if (rawEvents.length === 0) {
            console.warn('No events found for synchronized playback');
            return;
          }

          if (playbackRequestIdRef.current !== requestId) {
            return;
          }

          const ensureAudioDurationMs = async (): Promise<number | undefined> => {
            if (!audioElement) return undefined;
            const readDuration = () => {
              const { duration } = audioElement;
              if (!duration || !isFinite(duration) || duration <= 0) {
                return undefined;
              }
              return duration * 1000;
            };

            const known = readDuration();
            if (known !== undefined) {
              return known;
            }

            return new Promise<number | undefined>((resolve) => {
              const timeoutId = window.setTimeout(() => {
                audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
                resolve(readDuration());
              }, 1500);

              const onLoadedMetadata = () => {
                window.clearTimeout(timeoutId);
                audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
                resolve(readDuration());
              };

              audioElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            });
          };

          const audioDurationMs = await ensureAudioDurationMs();
          const lastEventTime = rawEvents[rawEvents.length - 1]?.time ?? 0;
          const needsScaling =
            !hasTempoMeta &&
            !!audioDurationMs &&
            lastEventTime > 0 &&
            Math.abs(audioDurationMs / lastEventTime - 1) > 0.05;

          const scaledEvents = needsScaling
            ? rawEvents.map((event) => ({
                ...event,
                time: event.time * (audioDurationMs! / lastEventTime),
              }))
            : rawEvents;

          playbackEventsRef.current = scaledEvents;
          playbackEventIndexRef.current = 0;
          playbackLastTimeRef.current = 0;

          const leadMs = 75; // Small visual lead feels responsive without obvious drift
          const toleranceMs = 25;

          const run = () => {
            if (playbackRequestIdRef.current !== requestId) {
              return;
            }

            if (!audioElement || audioElement.paused) {
              clearPlaybackVisualization();
              return;
            }

            const currentTimeMs = audioElement.currentTime * 1000;

            // Handle scrubbing backwards by resetting our pointers
            if (currentTimeMs + toleranceMs < playbackLastTimeRef.current) {
              playbackEventIndexRef.current = 0;
              playbackNotesRef.current.forEach(note => {
                if (!activeNotesRef.current.has(note)) {
                  animateKey(note, false);
                }
              });
              playbackNotesRef.current.clear();
            }
            playbackLastTimeRef.current = currentTimeMs;

            const pendingEvents = playbackEventsRef.current;
            while (playbackEventIndexRef.current < pendingEvents.length) {
              const event = pendingEvents[playbackEventIndexRef.current];
              const triggerTime = Math.max(0, event.time - leadMs);

              if (triggerTime <= currentTimeMs + toleranceMs) {
                if (event.type === 'on') {
                  playbackNotesRef.current.add(event.note);
                  animateKey(event.note, true);
                } else {
                  playbackNotesRef.current.delete(event.note);
                  animateKey(event.note, false);
                }
                playbackEventIndexRef.current += 1;
              } else {
                break;
              }
            }

            playbackRafRef.current = requestAnimationFrame(run);
          };

          playbackRafRef.current = requestAnimationFrame(run);
        } catch (error) {
          console.error('Error starting synchronized playback:', error);
        }
      };
      
      window.stopPlaybackWithVisualization = () => {
        clearPlaybackVisualization();
      };

      window.animatePianoKey = (note: number, isPressed: boolean) => {
        if (isPressed) {
          activeNotesRef.current.add(note);
        } else {
          activeNotesRef.current.delete(note);
        }
        animateKey(note, isPressed);
      };

      window.stopAllPianoAnimations = () => {
        // Stop all active note animations
        activeNotesRef.current.forEach((note) => {
          animateKey(note, false);
        });
        activeNotesRef.current.clear();
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.startSynchronizedPlayback;
        delete window.stopPlaybackWithVisualization;
        delete window.animatePianoKey;
        delete window.stopAllPianoAnimations;
      }
    };
  }, [clearPlaybackVisualization, animateKey]);


  const getNoteFromCoords = useCallback((x: number, y: number): number | null => {
    // Unchanged
    if (y < mechanicsHeight) return null;
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        whiteIndex++;
      } else {
        const keyX = (whiteIndex - 1) * keyWidth + keyWidth * 0.7;
        if (x >= keyX && x <= keyX + keyWidth * 0.6 && y <= mechanicsHeight + keyHeight * 0.6) {
          return i;
        }
      }
    }
    const keyIndex = Math.floor(x / keyWidth);
    whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
        if (!isBlack(i)) {
            if (whiteIndex === keyIndex) return i;
            whiteIndex++;
        }
    }
    return null;
  }, [isBlack, keyWidth, keyHeight, mechanicsHeight]);

  useEffect(() => {
    // Pointer event handling - unchanged
    const container = backgroundCanvasRef.current?.parentElement;
    if (!container) return;
    
    const getRelativeCoords = (e: MouseEvent | TouchEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * 1400;
      const y = ((clientY - rect.top) / rect.height) * 300;
      return { x, y };
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      pointerDownRef.current = true;
      const { x, y } = getRelativeCoords(e);
      const note = getNoteFromCoords(x, y);
      if (note !== null) {
        pointerNoteRef.current = note;
        if (!activeNotesRef.current.has(note)) {
          activeNotesRef.current.add(note);
          animateKey(note, true);
          if (isSoundOn) {
            playNote(note, 100);
            onNoteOn?.(note, 100);
          }
        }
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!pointerDownRef.current) return;
      const { x, y } = getRelativeCoords(e);
      const note = getNoteFromCoords(x, y);
      if (note !== pointerNoteRef.current) {
        if (pointerNoteRef.current !== null) {
          activeNotesRef.current.delete(pointerNoteRef.current);
          animateKey(pointerNoteRef.current, false);
          if (isSoundOn) stopNote(pointerNoteRef.current);
          onNoteOff?.(pointerNoteRef.current);
        }
        if (note !== null) {
          pointerNoteRef.current = note;
          if (!activeNotesRef.current.has(note)) {
            activeNotesRef.current.add(note);
            animateKey(note, true);
            if (isSoundOn) playNote(note, 100);
            onNoteOn?.(note, 100);
          }
        } else {
          pointerNoteRef.current = null;
        }
      }
    };

    const handlePointerUp = () => {
      pointerDownRef.current = false;
      if (pointerNoteRef.current !== null) {
        activeNotesRef.current.delete(pointerNoteRef.current);
        animateKey(pointerNoteRef.current, false);
        if (isSoundOn) stopNote(pointerNoteRef.current);
        onNoteOff?.(pointerNoteRef.current);
        pointerNoteRef.current = null;
      }
    };

    container.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    container.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      container.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      container.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [getNoteFromCoords, playNote, stopNote, animateKey, onNoteOn, onNoteOff, isSoundOn]);

  return (
    <div className="flex justify-center w-full mt-12 px-4">
      <div 
        className="relative rounded-lg overflow-hidden max-w-full shadow-xl bg-gray-100 border-2 border-gray-400"
        style={{ width: '1400px', height: '300px', maxWidth: '100%' }}
      >
        <canvas
          ref={backgroundCanvasRef}
          width="1400"
          height="300"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, width: '100%', height: '100%' }}
        />
        <canvas
          ref={activeKeysCanvasRef}
          width="1400"
          height="300"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, width: '100%', height: '100%' }}
        />
        <canvas
          ref={mechanicsCanvasRef}
          width="1400"
          height="300"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            zIndex: 3, 
            width: '100%', 
            height: '100%',
            opacity: isSoundOn ? 1 : 0.5,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
        {!isSoundOn && (
          <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, width: '100%', height: '100%' }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('startSound'))}
              className="absolute inset-0 flex items-center justify-center w-full h-full dark:bg-black/20 bg-white/20 rounded-lg text-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-600 transform hover:scale-105"
            >
              <span className="flex items-center gap-2 opacity-90 text-lg backdrop-blur-lg p-2 px-4 rounded-lg">
                Press to Play
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Global window type extension - unchanged
declare global {
  interface Window {
    playNote?: (note: number, velocity: number) => void;
    stopNote?: (note: number) => void;
    Tone?: typeof import('tone');
    startSynchronizedPlayback?: (recordingId: string, audioElement: HTMLAudioElement) => void;
    stopPlaybackWithVisualization?: () => void;
    animatePianoKey?: (note: number, isPressed: boolean) => void;
    stopAllPianoAnimations?: () => void;
  }
}
