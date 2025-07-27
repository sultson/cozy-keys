interface WaveformOptions {
  // Colors
  backgroundColor?: string;
  waveformColor?: string;
  progressColor?: string;
  progressLineColor?: string;
  centerLineColor?: string;
  
  // Dimensions
  width?: number;
  height?: number;
  
  // Styling
  centerLineWidth?: number;
  progressLineWidth?: number;
  waveformOpacity?: number;
  progressOpacity?: number;
}

interface DrawWaveformParams {
  canvas: HTMLCanvasElement;
  data: Float32Array | null;
  progress?: number;
  options?: WaveformOptions;
}

const defaultOptions: Required<WaveformOptions> = {
  // Colors
  backgroundColor: 'transparent',
  waveformColor: 'rgba(47, 64, 255, 0.7)',
  progressColor: 'rgba(59, 130, 246, 0.3)',
  progressLineColor: '#3b82f6',
  centerLineColor: 'rgba(137, 137, 137, 0.5)',
  
  // Dimensions
  width: 500,
  height: 60,
  
  // Styling
  centerLineWidth: 1,
  progressLineWidth: 2,
  waveformOpacity: 0.7,
  progressOpacity: 0.3,
};

export function drawWaveform({ 
  canvas, 
  data, 
  progress = 0, 
  options = {} 
}: DrawWaveformParams): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const opts = { ...defaultOptions, ...options };
  const width = opts.width;
  const height = opts.height;
  const amp = height / 2;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw background if specified
  if (opts.backgroundColor !== 'transparent') {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw center line
  ctx.strokeStyle = opts.centerLineColor;
  ctx.lineWidth = opts.centerLineWidth;
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();

  // Draw waveform
  if (data) {
    ctx.fillStyle = opts.waveformColor;
    const step = Math.ceil(data.length / width);
    for (let i = 0; i < width; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const yMin = amp + (min * amp);
      const yMax = amp + (max * amp);
      ctx.fillRect(i, yMin, 1, yMax - yMin);
    }
  }

  // Draw progress overlay and line
  if (progress > 0) {
    const progressX = progress * width;
    
    // Progress overlay
    ctx.fillStyle = opts.progressColor;
    ctx.fillRect(0, 0, progressX, height);
    
    // Progress line
    ctx.strokeStyle = opts.progressLineColor;
    ctx.lineWidth = opts.progressLineWidth;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();
  }
}

// Helper function to create waveform data from audio URL
export async function createWaveformData(audioUrl: string): Promise<Float32Array | null> {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Failed to fetch audio');
    
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error('Audio buffer is empty');
    
    const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(buffer);
    
    return audioBuffer.getChannelData(0);
  } catch (error) {
    console.error('Error creating waveform data:', error);
    return null;
  }
}

// Helper function to set up canvas with proper dimensions
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  // Set display size
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  // Set actual size in memory (scaled up for retina displays)
  const scale = window.devicePixelRatio;
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  // Scale the drawing context so everything draws at the correct size
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(scale, scale);
  }
}
