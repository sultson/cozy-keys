import { toast } from "sonner";
import { Button } from "./ui/button";
import { Loader2, BookHeart, Square, VolumeX, Volume2 } from "lucide-react";
import { useEffect } from "react";

export default function Cora({ isCoraActive, isCoraConnecting, toggleCora, toggleCoraMute, isCoraSessionMuted, coraError }: { isCoraActive: boolean, isCoraConnecting: boolean, toggleCora: () => void, toggleCoraMute: () => void, isCoraSessionMuted: boolean, coraError: string }) {


    useEffect(() => {
        if (coraError) {
            toast.error(coraError);
        }
    }, [coraError]);


  return (
    <>
    {/* Chords with Cora Buttons */}
    {!isCoraActive && !isCoraConnecting && (
                <Button  
                  variant="secondary"
                  onClick={toggleCora}
                  className="transition-all duration-200
                    dark:bg-gradient-to-r dark:from-indigo-900 dark:via-slate-800 dark:to-indigo-950 dark:text-indigo-100 dark:border-indigo-600 dark:shadow-lg dark:shadow-indigo-900/30
                    bg-gradient-to-r from-indigo-100 via-slate-100 to-white text-indigo-900 border border-indigo-300 shadow-lg shadow-indigo-200/40
                    hover:from-indigo-200 hover:to-indigo-100 hover:text-indigo-800 hover:border-indigo-400
                    dark:hover:from-indigo-800 dark:hover:to-indigo-900 dark:hover:text-indigo-50 dark:hover:border-indigo-400
                    focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:outline-none
                    active:scale-100 active:shadow-md
                    hover:scale-105 hover:shadow-xl"
                  title={coraError || 'Chords with Cora'}
                >
                  <BookHeart className="w-4 h-4 mr-2 text-indigo-500 group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-indigo-100 transition-colors duration-200" />
                  <span className="font-semibold tracking-wide">Chords with Cora</span>
                </Button>
              )}
              
              {isCoraConnecting && (
                <Button 
                  size="default"
                  variant="secondary"
                  disabled
                  className="transition-all duration-200"
                  title="Connecting to Cora..."
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </Button>
              )}
              
              {isCoraActive && (
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon"
                    variant="destructive"
                    onClick={toggleCora}
                    className="transition-all duration-200"
                    title="Stop Learning with Cora"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="icon"
                    variant={isCoraSessionMuted ? "outline" : "secondary"}
                    onClick={toggleCoraMute}
                    className="transition-all duration-200"
                    title={isCoraSessionMuted ? "Unmute Cora" : "Mute Cora"}
                  >
                    {isCoraSessionMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>
              )}
    </>
  )
}