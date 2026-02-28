import { useTranslation } from 'react-i18next';
import { useRecorderStore } from '../stores/recorderStore';
import { RecordButton } from './RecordButton';
import { ToggleControl } from './ToggleControl';
import { LanguageSelect } from './LanguageSelect';

export function RecorderControls() {
  const { i18n } = useTranslation();
  const {
    cameraOn,
    toggleCamera,
    micMuted,
    toggleMic,
    pcSoundOn,
    togglePcSound,
  } = useRecorderStore();

  return (
    <div
      className="flex items-center gap-4 p-4 bg-slate-900 text-white rounded-lg shadow-lg"
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
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
