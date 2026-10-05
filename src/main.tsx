import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import '@fontsource-variable/exo-2/index.css';
import '@fontsource-variable/geist/index.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/archivo-narrow/400.css';
import '@fontsource/archivo-narrow/500.css';
import '@fontsource/archivo-narrow/600.css';
import '@fontsource/archivo-narrow/700.css';
import '@fontsource-variable/sora/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import { IconContext } from '@phosphor-icons/react';
import { Shell } from './os/Shell';
import { applyWorld, getWorld } from './os/worlds/worlds';
import './index.css';

applyWorld(getWorld());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'duotone' }}>
      <Shell />
    </IconContext.Provider>
  </React.StrictMode>
);
