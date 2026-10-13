/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  // Optional: the websocket URL when it is not the API host's /ws (locally, the API's host on port 4001).
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Minimal surface of Google Identity Services (loaded via <script> in
// index.html) — just enough to render the sign-in button and read the
// credential it returns.
interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: { credential: string }) => void;
        }) => void;
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
      };
    };
  };
}
