import type { Environment } from '@/hooks/useSound';
import type { Recording } from '@/hooks/useRecording';
import  { useEffect, useRef, useCallback } from 'react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const playbackNotesRef = useRef<Set<number>>(new Set()); // NEW: track playback notes
  const keyAnimationsRef = useRef<Map<number, KeyAnimation>>(new Map());
  const animationIdRef = useRef<number | null>(null);
  const pointerDownRef = useRef<boolean>(false);
  const pointerNoteRef = useRef<number | null>(null);
  const isMidiConnectedRef = useRef<boolean>(false);

  const whiteKeys = 52;
  const keyWidth = 1400 / whiteKeys;
  const keyHeight = 200; // Keys take up bottom 200px
  const mechanicsHeight = 100; // Top 100px for strings/hammers

  const isBlack = useCallback((note: number): boolean => {
    return [1, 3, 6, 8, 10].includes(note % 12);
  }, []);

  const getEnvironmentColors = useCallback(() => {
    switch (environment) {
      case 'nature':
        return {
          stringBg: ['#2d5016', '#1a2e0e'], // Forest greens
          blackStrings: '#4a7c59', // Moss green
          whiteStrings: '#6b8e7a', // Sage green
          pressedGlow: '#22c55e', // Bright green
          pressedKey: '#16a34a', // Emerald green
        };
      case 'cosmic':
        return {
          stringBg: ['#1e1b4b', '#0f0f23'], // Deep space blues
          blackStrings: '#6366f1', // Indigo
          whiteStrings: '#8b5cf6', // Purple
          pressedGlow: '#06b6d4', // Cyan
          pressedKey: '#0891b2', // Sky blue
        };
      default: // studio/quiet
        return {
          stringBg: ['#2d3748', '#1a202c'], // Professional grays
          blackStrings: '#4a5568', // Steel gray
          whiteStrings: '#718096', // Light gray
          pressedGlow: '#60a5fa', // Blue
          pressedKey: '#3b82f6', // Professional blue
        };
    }
  }, [environment]);

  const drawStrings = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.save();
    
    const colors = getEnvironmentColors();
    
    // String area background
    const stringBg = ctx.createLinearGradient(0, 0, 0, mechanicsHeight);
    stringBg.addColorStop(0, colors.stringBg[0]);
    stringBg.addColorStop(1, colors.stringBg[1]);
    ctx.fillStyle = stringBg;
    ctx.fillRect(0, 0, canvas.width, mechanicsHeight);
    
    // Draw strings with environment colors
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      const isBlackKey = isBlack(i);
      let x;
      
      if (!isBlackKey) {
        x = whiteIndex * keyWidth + keyWidth / 2;
        whiteIndex++;
      } else {
        x = (whiteIndex - 1) * keyWidth + keyWidth * 0.85;
      }
      
      // Environment-themed strings
      ctx.strokeStyle = isBlackKey ? colors.blackStrings : colors.whiteStrings;
      ctx.lineWidth = isBlackKey ? 1.2 : 0.8;
      
      // String vibration effect when pressed - more subtle
      const vibration = activeNotesRef.current.has(i) ? Math.sin(Date.now() * 0.015) * 0.5 : 0;
      
      ctx.beginPath();
      ctx.moveTo(x + vibration, 10);
      ctx.lineTo(x + vibration * 0.3, mechanicsHeight - 10);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [isBlack, keyWidth, mechanicsHeight, getEnvironmentColors]);

  const drawHammers = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save();
    
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      const isBlackKey = isBlack(i);
      let x;
      
      if (!isBlackKey) {
        x = whiteIndex * keyWidth + keyWidth / 2;
        whiteIndex++;
      } else {
        x = (whiteIndex - 1) * keyWidth + keyWidth * 0.85;
      }
      
      // Hammer animation
      const anim = keyAnimationsRef.current.get(i);
      const hammerOffset = anim ? anim.progress * 15 : 0;
      const hammerY = mechanicsHeight - 30 - hammerOffset;
      
      // Hammer head - gray shades only
      ctx.fillStyle = activeNotesRef.current.has(i) ? '#9ca3af' : '#6b7280';
      ctx.beginPath();
      ctx.ellipse(x, hammerY, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Hammer arm - gray
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, hammerY + 6);
      ctx.lineTo(x - 8, hammerY + 20);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [isBlack, keyWidth, mechanicsHeight]);

  const drawKey3D = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isPressed: boolean, isBlackKey: boolean = false, isPlayback: boolean = false) => {
    const depth = isBlackKey ? 6 : 10;
    const pressDepth = isPressed ? depth * 0.6 : depth;
    
    // Perspective calculations
    const perspectiveRatio = 0.85;
    const topY = y + height * 0.15;
    const topWidth = width * perspectiveRatio;
    const topX = x + (width - topWidth) / 2;
    
    ctx.save();
    
    const colors = getEnvironmentColors();
    
    // Softer shadow with perspective
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    const shadowY = y + height * 0.05 + (isPressed ? 1 : 2);
    ctx.fillRect(x + 1, shadowY, width, height * 0.95);
    
    // Main key face with environment-specific pressed colors
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    if (isBlackKey) {
      if (isPressed) {
        if (isPlayback) {
          // Gray colors for playback visualization
          gradient.addColorStop(0, '#9ca3af'); // Light gray
          gradient.addColorStop(0.5, '#6b7280');
          gradient.addColorStop(1, '#4b5563');
        } else {
          gradient.addColorStop(0, colors.pressedGlow); // Environment-specific glow
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
          // Gray colors for playback visualization
          gradient.addColorStop(0, '#e5e7eb'); // Light gray
          gradient.addColorStop(0.5, '#d1d5db');
          gradient.addColorStop(1, '#9ca3af');
        } else {
          // Environment-specific white key pressed colors
          if (environment === 'nature') {
            gradient.addColorStop(0, '#dcfce7'); // Light green
            gradient.addColorStop(0.5, '#bbf7d0');
            gradient.addColorStop(1, '#22c55e');
          } else if (environment === 'cosmic') {
            gradient.addColorStop(0, '#e0e7ff'); // Light blue
            gradient.addColorStop(0.5, '#c7d2fe');
            gradient.addColorStop(1, '#6366f1');
          } else {
            gradient.addColorStop(0, '#fef3c7'); // Warm yellow (studio)
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
    
    // Draw trapezoid for perspective
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + topWidth, topY);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
    
    // Enhanced glow for pressed keys with environment colors
    if (isPressed) {
      const glowColor = isBlackKey ? colors.pressedGlow : 
        (environment === 'nature' ? '#22c55e' : 
         environment === 'cosmic' ? '#6366f1' : '#f59e0b');
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX + topWidth, topY);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      ctx.stroke();
    }
    
    // Top surface with blur and environment colors
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
    
    // Right edge with environment colors
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

  const drawPiano = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw strings and hammers first
    drawStrings(ctx, canvas);
    drawHammers(ctx);
    
    // Background gradient for key area with environment colors
    const bgGradient = ctx.createLinearGradient(0, mechanicsHeight, 0, canvas.height);
    if (environment === 'nature') {
      bgGradient.addColorStop(0, '#f0fdf4'); // Light green
      bgGradient.addColorStop(1, '#dcfce7');
    } else if (environment === 'cosmic') {
      bgGradient.addColorStop(0, '#f8fafc'); // Light blue
      bgGradient.addColorStop(1, '#e0e7ff');
    } else {
      bgGradient.addColorStop(0, '#f8fafc'); // Studio gray
      bgGradient.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, mechanicsHeight, canvas.width, keyHeight);
    
    // Smooth transition gradient from key area to black bottom
    const transitionGradient = ctx.createLinearGradient(0, canvas.height - 5, 0, canvas.height);
    transitionGradient.addColorStop(0, '#94a3b8');
    transitionGradient.addColorStop(0.3, '#94a3b8');
    transitionGradient.addColorStop(0.7, '#94a3b8');
    transitionGradient.addColorStop(1, '#000000');
    ctx.fillStyle = transitionGradient;
    ctx.fillRect(0, canvas.height - 5, canvas.width, 40);
    
    let whiteIndex = 0;

    // White keys
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        const x = whiteIndex * keyWidth;
        const anim = keyAnimationsRef.current.get(i);
        const isPressed = anim ? anim.progress > 0.5 : false;
        const pressOffset = anim ? anim.progress * 8 : 0;
        const isPlayback = playbackNotesRef.current.has(i) && !activeNotesRef.current.has(i);
        
        drawKey3D(ctx, x + 2, mechanicsHeight + pressOffset, keyWidth - 4, keyHeight - 4, isPressed, false, isPlayback);
        whiteIndex++;
      }
    }

    // Black keys
    whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        whiteIndex++;
      } else {
        const x = (whiteIndex - 1) * keyWidth + keyWidth * 0.7;
        const anim = keyAnimationsRef.current.get(i);
        const isPressed = anim ? anim.progress > 0.5 : false;
        const pressOffset = anim ? anim.progress * 6 : 0;
        const isPlayback = playbackNotesRef.current.has(i) && !activeNotesRef.current.has(i);
        
        drawKey3D(ctx, x, mechanicsHeight + pressOffset, keyWidth * 0.6, keyHeight * 0.6, isPressed, true, isPlayback);
      }
    }
  }, [drawStrings, drawHammers, drawKey3D, isBlack, keyWidth, keyHeight, mechanicsHeight, environment, playbackNotesRef, activeNotesRef]);

  const animateKey = useCallback((note: number, isPressed: boolean) => {
    if (!keyAnimationsRef.current.has(note)) {
      keyAnimationsRef.current.set(note, { progress: 0, target: 0 });
    }
    
    const anim = keyAnimationsRef.current.get(note)!;
    anim.target = isPressed ? 1 : 0;
    
    if (!animationIdRef.current) {
      const animate = () => {
        let needsUpdate = false;
        
        for (const [, anim] of keyAnimationsRef.current) {
          const diff = anim.target - anim.progress;
          if (Math.abs(diff) > 0.01) {
            anim.progress += diff * 0.15; // Smooth easing
            needsUpdate = true;
          } else {
            anim.progress = anim.target;
          }
        }
        
        if (needsUpdate) {
          drawPiano();
          animationIdRef.current = requestAnimationFrame(animate);
        } else {
          animationIdRef.current = null;
        }
      };
      animate();
    }
  }, [drawPiano]);

  const handleMIDIMessage = useCallback((message: MIDIMessageEvent) => {
    if (!message.data || message.data.length < 3) return;
    
    const [command, note, velocity] = Array.from(message.data);
    const isNoteOn = command === 144 && velocity > 0;
    const isNoteOff = command === 128 || (command === 144 && velocity === 0);

    console.log(`MIDI: command=${command}, note=${note}, velocity=${velocity}, isNoteOn=${isNoteOn}, isNoteOff=${isNoteOff}`);

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



  // NEW: Function to clear playback visualization
  const clearPlaybackVisualization = useCallback(() => {
    playbackNotesRef.current.clear();
    // Reset all key animations for playback
    for (let note = 21; note <= 108; note++) {
      const anim = keyAnimationsRef.current.get(note);
      if (anim && anim.target === 1 && activeNotesRef.current.has(note)) {
        // Keep user-pressed keys as they are
        continue;
      } else if (anim && anim.target === 1) {
        // Reset playback keys
        animateKey(note, false);
      }
    }
  }, []);

  // NEW: Expose synchronized playback functions to parent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.startSynchronizedPlayback = (recording: Recording, audioElement: HTMLAudioElement) => {
        clearPlaybackVisualization();
        
        // Create a synchronized playback system
        const checkEvents = () => {
          if (!audioElement || audioElement.paused) {
            clearPlaybackVisualization();
            return;
          }
          
          const currentTimeMs = audioElement.currentTime * 1000; // Convert to milliseconds
          
          // Find events that should be triggered at this time
          recording.events.forEach(event => {
            const eventTimeMs = event.time;
            const tolerance = 100; // 100ms tolerance for timing
            const futureOffset = 150; // 50ms ahead of audio for better visual feedback
            
            // Check if we're approaching the event time (with future offset)
            if (Math.abs(currentTimeMs - (eventTimeMs - futureOffset)) < tolerance) {
              if (event.type === 'on') {
                playbackNotesRef.current.add(event.note);
                animateKey(event.note, true);
              } else if (event.type === 'off') {
                playbackNotesRef.current.delete(event.note);
                animateKey(event.note, false);
              }
            }
          });
          
          // Continue checking
          requestAnimationFrame(checkEvents);
        };
        
        // Start the synchronized playback
        requestAnimationFrame(checkEvents);
      };
      
      window.stopPlaybackWithVisualization = () => {
        clearPlaybackVisualization();
      };

      // NEW: Expose functions for voice agent visual feedback
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

  // Map x/y to MIDI note number
  const getNoteFromCoords = useCallback((x: number, y: number): number | null => {
    // Only allow interaction in the key area
    if (y < mechanicsHeight) return null;
    // First, check black keys (drawn on top)
    let whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        whiteIndex++;
      } else {
        const keyX = (whiteIndex - 1) * keyWidth + keyWidth * 0.7;
        const keyY = mechanicsHeight;
        const width = keyWidth * 0.6;
        const height = keyHeight * 0.6;
        if (
          x >= keyX && x <= keyX + width &&
          y >= keyY && y <= keyY + height
        ) {
          return i;
        }
      }
    }
    // Then, check white keys
    whiteIndex = 0;
    for (let i = 21; i <= 108; i++) {
      if (!isBlack(i)) {
        const keyX = whiteIndex * keyWidth;
        const keyY = mechanicsHeight;
        const width = keyWidth;
        const height = keyHeight;
        if (
          x >= keyX && x <= keyX + width &&
          y >= keyY && y <= keyY + height
        ) {
          return i;
        }
        whiteIndex++;
      }
    }
    return null;
  }, [isBlack, keyWidth, keyHeight, mechanicsHeight]);

  // Handle pointer events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getRelativeCoords = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return { x: 0, y: 0 };
      }
      // Scale to canvas coordinates
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
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
        // Release previous note
        if (pointerNoteRef.current !== null) {
          activeNotesRef.current.delete(pointerNoteRef.current);
          animateKey(pointerNoteRef.current, false);
          if (isSoundOn) {
            stopNote(pointerNoteRef.current);
            onNoteOff?.(pointerNoteRef.current);
          }
        }
        // Press new note
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
        if (isSoundOn) {
          stopNote(pointerNoteRef.current);
          onNoteOff?.(pointerNoteRef.current);
        }
        pointerNoteRef.current = null;
      }
    };

    // Mouse events
    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    // Touch events
    canvas.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      canvas.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [getNoteFromCoords, playNote, stopNote, animateKey, onNoteOn, onNoteOff, isSoundOn]);

  useEffect(() => {
    drawPiano();
  }, [drawPiano]);

  return (
    <div className="flex justify-center w-full mt-12 px-4">
      <div className="relative rounded-lg overflow-hidden max-w-full shadow-xl">
        <canvas 
          ref={canvasRef}
          width="1400" 
          height="300" 
          className="block mx-auto bg-gray-100 border-2 border-gray-400 rounded-lg max-w-full h-auto"
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            opacity: isSoundOn ? 1 : 0.5,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
        {!isSoundOn && (
         
              <button
                onClick={() => {
                  // This will be handled by the parent component
                  const event = new CustomEvent('startSound');
                  window.dispatchEvent(event);
                }}
                className="absolute inset-0 flex items-center justify-center  dark:bg-black/20 bg-white/20 rounded-lg text-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-600 transform hover:scale-105"
              >
                <span className="flex items-center gap-2 opacity-90 text-lg backdrop-blur-lg p-2 px-4 rounded-lg

">
                  Press to Play
                </span>
              </button>
        
        )}
      </div>
    </div>
  );
}

// Extend window type for global functions
declare global {
  interface Window {
    playNote?: (note: number, velocity: number) => void;
    stopNote?: (note: number) => void;
    Tone?: typeof import('tone');
    startSynchronizedPlayback?: (recording: Recording, audioElement: HTMLAudioElement) => void;
    stopPlaybackWithVisualization?: () => void;
    animatePianoKey?: (note: number, isPressed: boolean) => void;
    stopAllPianoAnimations?: () => void;
  }
}