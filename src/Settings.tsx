import { Slider } from "@radix-ui/react-slider";
import { Button } from "./components/ui/button";

const Settings = ({
  showSettings,
  releaseTime,
  setReleaseTime,
  playChordsTool,
}: {
  showSettings: boolean;
  releaseTime: number;
  setReleaseTime: (value: number) => void;
  playChordsTool: (params: {
    chords: string[];
    velocity?: number;
    duration?: number;
  }) => Promise<string>;
}) => {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 p-32 bg-background/80 backdrop-blur ${
        showSettings ? "block" : "hidden"
      } flex flex-col items-start justify-center h-full gap-4`}
    >
      <p>Release (unstable) {releaseTime / 1000}s</p>
      <Slider
        min={0}
        max={5000}
        step={100}
        value={[releaseTime]}
        onValueChange={(value) => setReleaseTime(value[0])}
      />
      <Button
        onClick={() =>
          playChordsTool({
            chords: ["Cmaj9", "F#7b9", "Bm7b5", "E7alt", "Am9", "D13", "Gmaj7"],
            velocity: 100,
            duration: 1,
          })
        }
      >
        Play Chords
      </Button>
    </div>
  );
};

export default Settings;
