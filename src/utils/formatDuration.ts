/**
 * Formats a duration in seconds to MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1:23", "0:45", "2:05")
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '0:00';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  // Format seconds with leading zero if needed
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  
  return `${minutes}:${formattedSeconds}`;
} 