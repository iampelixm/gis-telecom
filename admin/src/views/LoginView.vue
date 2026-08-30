<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMessage } from 'naive-ui';
import { auth } from '../auth';

const router = useRouter();
const route = useRoute();
const message = useMessage();

const username = ref('admin');
const loading = ref(false);

async function submit() {
  if (!username.value.trim()) {
    message.warning('Введите имя пользователя');
    return;
  }
  loading.value = true;
  try {
    await auth.login(username.value.trim());
    if (!auth.hasPermission('object-types:manage')) {
      message.error('Недостаточно прав: требуется object-types:manage');
      auth.logout();
      loading.value = false;
      return;
    }
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка входа');
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <n-card class="login-card" title="Вход в админку">
      <n-form @submit.prevent="submit">
        <n-form-item label="Пользователь">
          <n-input
            v-model:value="username"
            placeholder="admin / engineer / viewer"
            @keyup.enter="submit"
          />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="submit">
          Войти
        </n-button>
      </n-form>
      <div class="hint">
        Тестовые пользователи: <code>admin</code> (полный доступ),
        <code>engineer</code>, <code>viewer</code> (без прав на справочники).
      </div>
    </n-card>
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
}

.hint {
  margin-top: 16px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
