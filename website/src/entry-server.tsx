import { renderToString } from 'react-dom/server';
import { App } from './app';

// Used only at build time, by scripts/prerender.mjs.
export const render = () => renderToString(<App />);
