<script setup>
import { computed, onMounted } from 'vue';
import { auth } from './auth';
import LoginForm from './components/LoginForm.vue';
import MapView from './components/MapView.vue';

const ready = computed(() => auth.state.loaded);
const loggedIn = computed(() => !!auth.state.user);

onMounted(() => {
  auth.loadUser();
});
</script>

<template>
  <LoginForm v-if="ready && !loggedIn" @success="auth.loadUser" />
  <MapView v-else-if="ready && loggedIn" />
  <div v-else class="boot">Загрузка…</div>
</template>

<style scoped>
.boot {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}
</style>
