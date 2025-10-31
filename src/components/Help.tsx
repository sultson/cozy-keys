import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';

const EGG_USER_KEY = 'isEggUser';

export function Help() {
  const [isOpen, setIsOpen] = useState(false);
  const [_isEggUser, setIsEggUser] = useState(true);

  useEffect(() => {
    // Check if user is new (egg user)
    const storedEggUser = localStorage.getItem(EGG_USER_KEY);
    const isNewUser = storedEggUser === null || storedEggUser === 'true';

    setIsEggUser(isNewUser);

    // Auto-open popover for new users
    if (isNewUser) {
      setIsOpen(true);
    }
  }, []);

  const handleLetsGo = () => {
    setIsOpen(false);
    setIsEggUser(false);
    localStorage.setItem(EGG_USER_KEY, 'false');
  };

  return (
    <div className="fixed bottom-16 right-4 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded-full h-10 w-10 shadow-lg bg-background/80 backdrop-blur-sm border-2 hover:bg-accent hover:scale-105 transition-all duration-200"
            title="Help & Getting Started"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-96 max-w-[90vw] p-6"
          align="end"
          side="top"
          sideOffset={12}
        >
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Welcome to Cozy Keys!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your virtual piano companion. Here's how to get started:
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
                  Connect Your Instrument
                </h4>
                <p className="text-sm text-muted-foreground ml-8">
                  Connect a MIDI keyboard for the best experience, or use touch controls on mobile/tablet, or computer keyboard for quick play.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
                  Record Your Play
                </h4>
                <p className="text-sm text-muted-foreground ml-8">
                  Press the red record button to start recording. Play your melody, then press again to stop. Your recording will be saved automatically.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
                  Share & Playback
                </h4>
                <p className="text-sm text-muted-foreground ml-8">
                  View your recordings below the piano. Make them public to share, or keep private. Listen to recordings with synchronized piano playback, and download in MIDI or audio format.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                  Sound Presets
                </h4>
                <p className="text-sm text-muted-foreground ml-8">
                  Choose from different instrument presets using the dropdown in the top bar. Try different piano types and sounds to find your favorite.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">5</span>
                  Environment Selector
                </h4>
                <p className="text-sm text-muted-foreground ml-8">
                  Change the visual environment around your piano. Switch between quiet, nature, and cosmic themes to create your perfect atmosphere.
                </p>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLetsGo}
                className="px-8 py-2"
              >
                Let's go!
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
