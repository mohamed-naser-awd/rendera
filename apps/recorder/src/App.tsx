import { useTranslation } from 'react-i18next';
import { useRecorderUrlParams } from './hooks/useRecorderUrlParams';
import { RecorderControls } from './components';

export default function App() {
  useRecorderUrlParams();
  const { i18n } = useTranslation();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#1e1e1e]"
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <RecorderControls />
    </div>
  );
}
