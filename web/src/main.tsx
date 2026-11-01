import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MotionConfig } from 'motion/react';
import App from './App';
import { ToastProvider } from './components/ui';
import { store } from './store';
// Self-hosted Anek Tamil (Latin + Tamil, width and weight axes) — no third-party font request.
import '@fontsource-variable/anek-tamil/standard.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      {/* "user" = follow the visitor's reduce-motion setting everywhere */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </Provider>
  </StrictMode>,
);
