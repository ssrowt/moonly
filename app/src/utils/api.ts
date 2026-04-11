import { getInitData } from './telegram';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = getInitData();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    const err: any = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.code = data.error;
    throw err;
  }

  return data;
}

export const api = {
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
