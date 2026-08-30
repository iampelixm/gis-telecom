import { reactive } from 'vue';
import { api } from './api';
import type { JwtUser } from './types';

interface AuthState {
  user: JwtUser | null;
  token: string | null;
  loaded: boolean;
}

const state = reactive<AuthState>({
  user: null,
  token: localStorage.getItem('token'),
  loaded: false,
});

export const auth = {
  state,

  hasPermission(permission: string): boolean {
    const perms = state.user?.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  },

  async login(username: string): Promise<void> {
    const { token } = await api.login(username);
    localStorage.setItem('token', token);
    state.token = token;
    await this.loadUser();
  },

  async loadUser(): Promise<void> {
    if (!state.token) {
      state.loaded = true;
      return;
    }
    try {
      state.user = await api.me();
    } catch {
      this.logout();
    }
    state.loaded = true;
  },

  logout(): void {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
  },
};
