import { useTranslation } from 'react-i18next';
import { useRecorderStore } from '../stores/recorderStore';

export function RecordButton() {
  const { t } = useTranslation();
  const { isRecording, startRecording, stopRecording } = useRecorderStore();

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        isRecording
          ? 'bg-rose-500 hover:bg-rose-600 text-white'
          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
      }`}
    >
      {isRecording ? t('recorder.stop') : t('recorder.record')}
    </button>
  );
}
