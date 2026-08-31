import { reactive } from 'vue';
import { api } from './api';

const state = reactive({
  user: null,
  token: localStorage.getItem('token'),
  loaded: false,
});

export const auth = {
  state,

  hasPermission(permission) {
    const perms = state.user?.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  },

  hasObjectRead(typeCode) {
    return this.hasPermission(`objects:${typeCode}:read`);
  },

  hasObjectWrite(typeCode) {
    return this.hasPermission(`objects:${typeCode}:write`);
  },

  hasRelationRead(typeCode) {
    return this.hasPermission(`object-relations:${typeCode}:read`);
  },

  hasRelationWrite(typeCode) {
    return this.hasPermission(`object-relations:${typeCode}:write`);
  },

  async login(username) {
    const { token } = await api.login(username);
    localStorage.setItem('token', token);
    state.token = token;
    await this.loadUser();
  },

  async loadUser() {
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

  logout() {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
  },
};
