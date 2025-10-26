const TICKS_PER_QUARTER = 480;
const MS_PER_QUARTER = 1000; // Matches recording timer (60 BPM baseline)

export const MICROSECONDS_PER_QUARTER = MS_PER_QUARTER * 1000; // 1,000,000µs

const msPerTickFromTempo = (microsecondsPerQuarter: number): number =>
  (microsecondsPerQuarter / 1000) / TICKS_PER_QUARTER;

export const msToTicks = (ms: number, microsecondsPerQuarter: number = MICROSECONDS_PER_QUARTER): number => {
  const msPerTick = msPerTickFromTempo(microsecondsPerQuarter);
  return Math.max(0, Math.round(ms / msPerTick));
};

export const ticksToMs = (ticks: number, microsecondsPerQuarter: number = MICROSECONDS_PER_QUARTER): number => {
  const msPerTick = msPerTickFromTempo(microsecondsPerQuarter);
  return ticks * msPerTick;
};
