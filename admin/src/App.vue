<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui';
import { ruRU, dateRuRU } from 'naive-ui';
</script>

<template>
  <NConfigProvider :locale="ruRU" :date-locale="dateRuRU">
    <NMessageProvider>
      <NDialogProvider>
        <router-view />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
