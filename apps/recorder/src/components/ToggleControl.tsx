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
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isOn
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
          : 'bg-[#383838] hover:bg-[#424242] text-white/90 border border-white/5'
      }`}
      title={label}
    >
      {label} {status}
    </button>
  );
}
