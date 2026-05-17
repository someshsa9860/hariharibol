import axios, { AxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function genRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Track retried requests to prevent infinite loops on 401
const retriedRequests = new WeakSet<object>();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  config.headers['X-Request-Id'] = genRequestId();

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('hhb-app-store');
    if (raw) {
      try {
        const state = JSON.parse(raw);
        const token = state?.state?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {}
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'data' in res.data && 'statusCode' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  async (err) => {
    const status: number | undefined = err.response?.status;
    const original: AxiosRequestConfig | undefined = err.config;

    if (status === 401 && original && !retriedRequests.has(original)) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) return reject(err);
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            resolve(api(original));
          });
        });
      }

      retriedRequests.add(original);
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const newToken: string | undefined = data?.accessToken;

        if (newToken && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('hhb-app-store');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.state) parsed.state.token = newToken;
              localStorage.setItem('hhb-app-store', JSON.stringify(parsed));
            }
          } catch {}
        }

        drainQueue(newToken ?? null);
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      } catch {
        drainQueue(null);
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (typeof status === 'number' && status >= 500 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hhb:toast', {
          detail: { message: 'Server error — please try again later.', type: 'error' },
        }),
      );
    }

    return Promise.reject(err);
  },
);

export default api;
