import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import './styles.css';
import './game.css';
import { exportSoundWav, measureSound } from './audio';

// SILENT effects check (browser tests): renders into an offline recorder and only measures or exports
Object.assign(window, { melinaSoundCheck: measureSound, melinaSoundWav: exportSoundWav });

createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
