import { useRecorderUrlParams } from './hooks/useRecorderUrlParams';
import { RecorderControls } from './components';

export default function App() {
  useRecorderUrlParams();

  return <RecorderControls />;
}
