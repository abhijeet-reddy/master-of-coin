import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@/design/fonts';
import '@/design/reset.css';
import '@/design/tokens.css';
import '@/design/global.css';
import '@/design/motion.css';
import { initSweep, initTheme } from '@/design';
import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';

initTheme();
initSweep();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>
);
