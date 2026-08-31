<script setup lang="ts">
import { h, ref } from 'vue';
import { useRouter, useRoute, type RouteRecordRaw } from 'vue-router';
import { NMenu, NAvatar, NLayoutSider, NLayoutHeader, NButton } from 'naive-ui';
import { auth } from '../auth';

const router = useRouter();
const route = useRoute();

const menuOptions = [
  { label: 'Слои', key: 'layers' },
  { label: 'Типы объектов', key: 'object-types' },
  { label: 'Типы связей', key: 'relation-types' },
  { label: 'Трассы', key: 'routes' },
];

const activeKey = ref(route.name as string);

function onSelect(key: string) {
  router.push({ name: key });
}

const collapsed = ref(false);

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider
      bordered
      :collapsed="collapsed"
      collapse-mode="width"
      :width="220"
      :collapsed-width="64"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="brand">DMAP Admin</div>
      <n-menu
        :value="activeKey"
        :options="menuOptions"
        @update:value="onSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="header">
        <div class="spacer" />
        <n-avatar round size="small">{{ auth.state.user?.name?.charAt(0) }}</n-avatar>
        <span class="user-name">{{ auth.state.user?.name }}</span>
        <n-button quaternary size="small" @click="logout">Выйти</n-button>
      </n-layout-header>
      <n-layout-content content-style="padding: 16px">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.brand {
  font-weight: 700;
  padding: 12px 16px;
  font-size: 16px;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 48px;
}

.spacer {
  flex: 1;
}

.user-name {
  font-size: 14px;
}
</style>
