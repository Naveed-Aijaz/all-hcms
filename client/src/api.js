// Thin fetch wrapper: base URL, bearer token, JSON errors -> ApiError, downloads.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY = 'hcm_token';

let token = null;
try { token = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
let onUnauthorized = () => {};

export const getToken = () => token;
export function setToken(t) {
  token = t;
  try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const assetUrl = (path) => `${BASE}${path}`;

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

const qs = (query) => {
  const p = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request(method, path, { body, query, form, blob } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`${BASE}/api${path}${qs(query)}`, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
  }
  if (blob && res.ok) return { blob: await res.blob(), filename: (/filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '') || [])[1] };
  let json = null;
  try { json = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = json && json.error ? json.error : {};
    if (res.status === 401 && token && err.code === 'TOKEN_INVALID') onUnauthorized();
    throw new ApiError(err.message || `Request failed (${res.status})`, res.status, err.code, err.details);
  }
  return json;
}

export const api = {
  get: (p, query) => request('GET', p, { query }),
  post: (p, body) => request('POST', p, { body }),
  put: (p, body) => request('PUT', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  del: (p) => request('DELETE', p),
  upload: (p, form, query) => request('POST', p, { form, query }),
  download: async (p, query) => {
    const { blob, filename } = await request('GET', p, { query, blob: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};
