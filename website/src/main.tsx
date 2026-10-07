import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app';
import './styles/index.css';

const root = document.getElementById('root')!;
const page = (
  <StrictMode>
    <App />
  </StrictMode>
);

// A built page already holds the prerendered HTML (scripts/prerender.mjs), so
// React only attaches to it. The dev server serves an empty root and renders.
if (root.hasChildNodes()) hydrateRoot(root, page);
else createRoot(root).render(page);
