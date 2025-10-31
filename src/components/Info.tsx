import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Info as InfoIcon } from 'lucide-react';

export function Info() {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded-full h-10 w-10 shadow-lg bg-background/80 backdrop-blur-sm border-2 hover:bg-accent hover:scale-105 transition-all duration-200"
            title="About Cozy Keys"
          >
            <InfoIcon className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 max-w-[90vw] p-6"
          align="end"
          side="top"
          sideOffset={12}
        >
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                About Cozy Keys
              </h3>
              <p className="text-sm text-muted-foreground">
                A browser-based piano and music learning platform
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium">Open Source</span>
                  <p className="text-muted-foreground mt-1">
                    This project is open source and available on GitHub.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium">Created by @sultson</span>
                  <p className="text-muted-foreground mt-1">
                    Built with passion for music education and web audio technology.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium">Get in Touch</span>
                  <p className="text-muted-foreground mt-1">
                    For ideas, bug reports, or anything else, reach out to{' '}
                    <a
                      href="mailto:cozy@docusera.com"
                      className="text-primary hover:underline"
                    >
                      cozy@docusera.com
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <a
                href="https://github.com/sultson/cozy-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
