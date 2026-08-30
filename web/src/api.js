const API_URL = import.meta.env.VITE_API_URL || '/api';
const MOCK_AUTH_URL = import.meta.env.VITE_MOCK_AUTH_URL || '/mock-auth';

export class ApiError extends Error {
  status;

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function token() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
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
  return res.json();
}

function jsonBody(data) {
  return { body: JSON.stringify(data) };
}

export const api = {
  login: async (username) => {
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

  me: () => request('/me'),

  layers: {
    list: () => request('/catalog/layers'),
  },

  objectTypes: {
    list: () => request('/catalog/object-types'),
  },

  objects: {
    list: (typeCode, bbox, limit = 2000) => {
      const params = new URLSearchParams({ type: typeCode });
      if (bbox) {
        params.set('bbox', bbox);
      }
      params.set('limit', String(limit));
      return request(`/objects?${params}`);
    },
  },
};
