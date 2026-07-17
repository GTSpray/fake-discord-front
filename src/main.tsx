import '@skyra/discord-components-core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installCaptureClock } from './lib/captureClock.ts';
import './styles/font/stylesheet.css';
import './styles/discord.css';

installCaptureClock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
