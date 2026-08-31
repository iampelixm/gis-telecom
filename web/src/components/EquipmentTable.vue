<script setup>
import { ref, watch, computed } from 'vue';
import { api } from '../api';
import { auth } from '../auth';

const props = defineProps({
  open: { type: Boolean, default: false },
  types: { type: Array, default: () => [] },
  mode: { type: String, default: 'modal' }, // 'modal' | 'split'
});

const emit = defineEmits(['close', 'focus', 'mode-change']);

const rows = ref([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const searched = ref(false);
let debounce = null;

const equipmentTypes = computed(() =>
  props.types.filter((t) => auth.hasObjectRead(t.code)),
);

function label(o) {
  const a = o.attrs || {};
  const main =
    a.device_type ||
    a.inventory_number ||
    a.model ||
    a.name ||
    a.ip ||
    a.title ||
    '';
  const base = typeof main === 'string' ? main : JSON.stringify(main);
  return `${base} (#${o.id})`;
}

function typeOf(o) {
  return props.types.find((t) => t.code === o.typeCode);
}

function centerOf(o) {
  const g = o.geometry;
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates.slice(0, 2);
  const coords = [];
  const collect = (c) => {
    if (Array.isArray(c[0])) c.forEach(collect);
    else coords.push(c);
  };
  collect(g.coordinates || []);
  if (!coords.length) return null;
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

function fmtCoord(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(5);
}

async function load(q) {
  if (!props.open || equipmentTypes.value.length === 0) {
    rows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const results = await Promise.all(
      equipmentTypes.value.map((t) =>
        api.objects.list({ type: t.code, search: q || undefined, limit: 500 }),
      ),
    );
    rows.value = results.flat().sort((a, b) => a.id - b.id);
    searched.value = true;
  } catch (err) {
    error.value = err?.message || String(err);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function onSearchInput() {
  clearTimeout(debounce);
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searched.value = false;
    rows.value = [];
    return;
  }
  debounce = setTimeout(() => load(q), 300);
}

function setMode(m) {
  emit('mode-change', m);
}

watch(
  () => [props.open, props.mode],
  () => {
    if (props.open) {
      clearTimeout(debounce);
      searchQuery.value = '';
      searched.value = false;
      rows.value = [];
      load('');
    }
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="props.open" :class="['equip-root', `mode-${props.mode}`]">
    <div class="equip-header">
      <strong>Оборудование</strong>
      <span v-if="!loading" class="equip-count">{{ rows.length }}</span>
      <div class="equip-modes">
        <button
          class="ghost"
          :class="{ active: props.mode === 'modal' }"
          @click="setMode('modal')"
        >Окно</button>
        <button
          class="ghost"
          :class="{ active: props.mode === 'split' }"
          @click="setMode('split')"
        >Сбоку</button>
      </div>
      <button class="ghost" title="Закрыть" @click="emit('close')">✕</button>
    </div>
    <div class="equip-toolbar">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Поиск по оборудованию (модель, IP, инв. №)…"
        autocomplete="off"
        @input="onSearchInput"
      />
    </div>
    <div class="equip-body">
      <div v-if="loading" class="equip-empty">Загрузка…</div>
      <div v-else-if="error" class="equip-empty equip-error">{{ error }}</div>
      <div v-else-if="!searched" class="equip-empty">
        Введите запрос (минимум 2 символа) или нажмите «Обновить» для полного списка
      </div>
      <div v-else-if="rows.length === 0" class="equip-empty">Ничего не найдено</div>
      <table v-else class="equip-table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Оборудование</th>
            <th>ID</th>
            <th>Широта</th>
            <th>Долгота</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="o in rows"
            :key="o.id"
            class="equip-row"
            @dblclick="emit('focus', o)"
          >
            <td>
              <span class="dot" :style="{ background: typeOf(o)?.color || '#888' }"></span>
              {{ typeOf(o)?.name || o.typeCode }}
            </td>
            <td class="cell-label" :title="label(o)">{{ label(o) }}</td>
            <td class="cell-id">#{{ o.id }}</td>
            <td class="cell-coord">{{ fmtCoord(centerOf(o)?.[1]) }}</td>
            <td class="cell-coord">{{ fmtCoord(centerOf(o)?.[0]) }}</td>
            <td class="cell-action">
              <button class="ghost" title="Перейти к объекту на карте" @click="emit('focus', o)">
                → на карту
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="equip-foot">
        <button class="ghost" :disabled="loading" @click="load(searchQuery.trim())">
          {{ searchQuery.trim().length >= 2 ? 'Обновить поиск' : 'Показать всё' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equip-root {
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mode-modal {
  position: absolute;
  inset: 0;
  z-index: 8;
}

.mode-split {
  position: absolute;
  top: 10px;
  right: 10px;
  bottom: 10px;
  width: 420px;
  max-width: calc(100% - 20px);
  z-index: 7;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
}

.equip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #111827;
  color: #fff;
  font-size: 14px;
}

.equip-count {
  background: #374151;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
}

.equip-modes {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.equip-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.equip-toolbar input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.equip-body {
  flex: 1;
  overflow: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
}

.equip-empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

.equip-error {
  color: #991b1b;
}

.equip-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.equip-table th {
  position: sticky;
  top: 0;
  background: #f9fafb;
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.equip-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
  white-space: nowrap;
}

.equip-row {
  cursor: pointer;
}

.equip-row:hover {
  background: #f9fafb;
}

.cell-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-id,
.cell-coord {
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.cell-action {
  text-align: right;
}

.equip-foot {
  padding-top: 8px;
  text-align: center;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.ghost {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.ghost:hover {
  background: #f9fafb;
}

.ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost.active {
  background: #111827;
  color: #fff;
  border-color: #111827;
}

@media (max-width: 700px) {
  .mode-split {
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    max-width: none;
    border-radius: 0;
    border: none;
  }

  .equip-toolbar input {
    font-size: 16px;
    min-height: 44px;
  }

  .equip-row .cell-coord {
    display: none;
  }

  .cell-action .ghost {
    min-height: 40px;
  }
}
</style>
