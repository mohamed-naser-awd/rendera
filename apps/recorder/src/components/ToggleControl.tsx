import { useTranslation } from 'react-i18next';

interface ToggleControlProps {
  labelKey: string;
  isOn: boolean;
  onToggle: () => void;
  offLabelKey?: string;
  onLabelKey?: string;
}

export function ToggleControl({
  labelKey,
  isOn,
  onToggle,
  offLabelKey = 'recorder.off',
  onLabelKey = 'recorder.on',
}: ToggleControlProps) {
  const { t } = useTranslation();
  const label = t(labelKey);
  const status = isOn ? t(onLabelKey) : t(offLabelKey);

  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 rounded ${isOn ? 'bg-blue-600' : 'bg-slate-600'}`}
      title={label}
    >
      {label} {status}
    </button>
  );
}
