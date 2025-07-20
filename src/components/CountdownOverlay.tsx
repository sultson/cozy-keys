import { useState, useEffect } from 'react';

interface CountdownOverlayProps {
  isVisible: boolean;
  onCountdownComplete: () => void;
}

export function CountdownOverlay({ isVisible, onCountdownComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setCount(3);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    
    const countdown = () => {
      if (count > 1) {
        setCount(count - 1);
      } else {
      
          setIsAnimating(false);
          onCountdownComplete();
      }
    };

    const interval = setInterval(countdown, 1000);
    return () => clearInterval(interval);
  }, [isVisible, count, onCountdownComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="mb-4">
        </div>
        <div className={`text-8xl font-bold text-white transition-all duration-300 ${
          isAnimating ? 'scale-125 animate-pulse' : ''
        }`}>
          {count}
        </div>

      </div>
    </div>
  );
} 