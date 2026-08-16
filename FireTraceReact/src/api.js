export const API_BASE_URL = 'http://192.168.1.22:8000';

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
