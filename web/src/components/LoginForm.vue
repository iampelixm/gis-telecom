<script setup>
import { ref } from 'vue';
import { auth } from '../auth';

const emit = defineEmits(['success']);

const username = ref('engineer');
const loading = ref(false);
const error = ref('');

async function submit() {
  if (!username.value.trim()) {
    error.value = 'Введите имя пользователя';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.login(username.value.trim());
    emit('success');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка входа';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <h1>GIS — карта сети</h1>
      <label for="username">Пользователь</label>
      <input
        id="username"
        v-model="username"
        placeholder="admin / engineer / viewer"
        autocomplete="username"
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Вход…' : 'Войти' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="hint">
        Тестовые пользователи: <code>admin</code> (полный доступ),
        <code>engineer</code> (редактирование), <code>viewer</code> (только просмотр).
      </p>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}

.login-card {
  width: 360px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

h1 {
  margin: 0 0 24px;
  font-size: 20px;
  color: #111827;
}

label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #374151;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

button {
  width: 100%;
  margin-top: 16px;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  margin: 12px 0 0;
  color: #dc2626;
  font-size: 13px;
}

.hint {
  margin: 16px 0 0;
  font-size: 12px;
  color: #6b7280;
}
</style>
