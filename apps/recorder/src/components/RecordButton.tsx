import { useTranslation } from 'react-i18next';
import { useRecorderStore } from '../stores/recorderStore';

export function RecordButton() {
  const { t } = useTranslation();
  const { isRecording, startRecording, stopRecording } = useRecorderStore();

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      className={`px-4 py-2 rounded font-medium ${
        isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
      }`}
    >
      {isRecording ? t('recorder.stop') : t('recorder.record')}
    </button>
  );
}
