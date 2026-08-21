// Set VITE_API_BASE_URL in FireTraceReact/.env when the backend is not on
// localhost — your LAN IP for phone testing, or a tunnel URL. Restart Vite
// after changing it; .env is only read at startup.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || Object.values(data).flat().join(' ') || 'Request failed');
  }
  return data;
}
