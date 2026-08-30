const API_URL = import.meta.env.VITE_API_URL || '/api';
const MOCK_AUTH_URL = import.meta.env.VITE_MOCK_AUTH_URL || '/mock-auth';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function token(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const t = token();
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body?.message)) {
        message = body.message.join('; ');
      }
    } catch {
      /* keep default message */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

function jsonBody(data: unknown): RequestInit {
  return { body: JSON.stringify(data) };
}

export const api = {
  login: async (username: string): Promise<{ token: string }> => {
    const res = await fetch(`${MOCK_AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'login failed');
    }
    return res.json();
  },

  me: (): Promise<import('./types').JwtUser> => request('/me'),

  layers: {
    list: () => request<import('./types').Layer[]>('/catalog/layers'),
    create: (data: Record<string, unknown>) =>
      request('/catalog/layers', { method: 'POST', ...jsonBody(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request(`/catalog/layers/${id}`, { method: 'PATCH', ...jsonBody(data) }),
    remove: (id: number) => request(`/catalog/layers/${id}`, { method: 'DELETE' }),
  },

  objectTypes: {
    list: () => request<import('./types').ObjectType[]>('/catalog/object-types'),
    create: (data: Record<string, unknown>) =>
      request('/catalog/object-types', { method: 'POST', ...jsonBody(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request(`/catalog/object-types/${id}`, { method: 'PATCH', ...jsonBody(data) }),
    remove: (id: number) =>
      request(`/catalog/object-types/${id}`, { method: 'DELETE' }),
  },

  relationTypes: {
    list: () => request<import('./types').RelationType[]>('/catalog/relation-types'),
    create: (data: Record<string, unknown>) =>
      request('/catalog/relation-types', { method: 'POST', ...jsonBody(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request(`/catalog/relation-types/${id}`, { method: 'PATCH', ...jsonBody(data) }),
    remove: (id: number) =>
      request(`/catalog/relation-types/${id}`, { method: 'DELETE' }),
  },
};
