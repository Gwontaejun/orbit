import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles/global.css';
import { AuthProvider } from '@/features/auth';
import { WorkspaceProvider } from './providers/workspace-provider';

createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
);
