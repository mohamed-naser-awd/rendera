import { useRecorderStore } from '../stores/recorderStore';
import { RecordButton } from './RecordButton';
import { ToggleControl } from './ToggleControl';
import { LanguageSelect } from './LanguageSelect';

export function RecorderControls() {
  const {
    cameraOn,
    toggleCamera,
    micMuted,
    toggleMic,
    pcSoundOn,
    togglePcSound,
  } = useRecorderStore();

  return (
    <div className="flex items-center gap-4 p-4 bg-[#2d2d2d] text-white rounded-lg border border-white/10 shadow-lg">
      <RecordButton />
      <ToggleControl
        labelKey="recorder.camera"
        isOn={cameraOn}
        onToggle={toggleCamera}
      />
      <ToggleControl
        labelKey="recorder.mic"
        isOn={!micMuted}
        onToggle={toggleMic}
        offLabelKey="recorder.muted"
      />
      <ToggleControl
        labelKey="recorder.pcSound"
        isOn={pcSoundOn}
        onToggle={togglePcSound}
      />
      <LanguageSelect />
    </div>
  );
}
