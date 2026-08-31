<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { api } from '../api';
import { auth } from '../auth';

const props = defineProps({
  open: { type: Boolean, default: false },
  types: { type: Array, default: () => [] },
  bbox: { type: String, default: '' },
});

const emit = defineEmits(['close', 'focus']);

const rows = ref([]);
const loading = ref(false);
const error = ref('');
const searchQuery = ref('');
const limitReached = ref(false);

function label(o) {
  const a = o.attrs || {};
  const main =
    a.inventory_number ||
    a.address ||
    a.name ||
    a.title ||
    a.device_type ||
    a.phone ||
    a.full_name ||
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

const readableTypes = computed(() =>
  props.types.filter((t) => auth.hasObjectRead(t.code)),
);

const cleanBbox = computed(() => props.bbox.split('##')[0] || '');

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (o) =>
      label(o).toLowerCase().includes(q) ||
      String(o.id).includes(q) ||
      (typeOf(o)?.name || '').toLowerCase().includes(q),
  );
});

async function load() {
  if (!props.open || !props.bbox || readableTypes.value.length === 0) {
    rows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  limitReached.value = false;
  try {
    const results = await Promise.all(
      readableTypes.value.map((t) =>
        api.objects.list({ type: t.code, bbox: cleanBbox.value, limit: 500 }),
      ),
    );
    rows.value = results.flat().sort((a, b) => a.id - b.id);
    limitReached.value = results.some((r) => r.length >= 500);
  } catch (err) {
    error.value = err?.message || String(err);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.bbox, readableTypes.value.map((t) => t.code).join(',')],
  () => {
    if (props.open) load();
    else rows.value = [];
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  rows.value = [];
});
</script>

<template>
  <div class="table-overlay">
    <div class="table-header">
      <strong>Объекты в области обзора</strong>
      <span v-if="!loading" class="table-count">
        {{ rows.length }}
      </span>
      <div class="table-header-actions">
        <button class="ghost" :disabled="loading" @click="load">Обновить</button>
        <button class="primary" @click="emit('close')">На карту</button>
      </div>
    </div>
    <div class="table-toolbar">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Фильтр по объектам в обзоре…"
        autocomplete="off"
      />
      <span v-if="limitReached" class="table-hint">Показаны первые 500 по типу</span>
    </div>
    <div class="table-body">
      <div v-if="loading" class="table-empty">Загрузка…</div>
      <div v-else-if="error" class="table-empty table-error">{{ error }}</div>
      <div v-else-if="filtered.length === 0" class="table-empty">
        Нет объектов в видимой области
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Объект</th>
            <th>ID</th>
            <th>Широта</th>
            <th>Долгота</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="o in filtered"
            :key="o.id"
            class="table-row"
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
              <button class="ghost" title="Перейти к объекту" @click="emit('focus', o)">
                → на карту
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #111827;
  color: #fff;
  font-size: 14px;
}

.table-count {
  background: #374151;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
}

.table-header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.table-toolbar input {
  flex: 1;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.table-hint {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.table-body {
  flex: 1;
  overflow: auto;
  padding: 0 16px 16px;
}

.table-empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

.table-error {
  color: #991b1b;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
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

.table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
  white-space: nowrap;
}

.table-row {
  cursor: pointer;
}

.table-row:hover {
  background: #f9fafb;
}

.cell-label {
  max-width: 340px;
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

button.primary {
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #fff;
  background: #374151;
}

@media (max-width: 700px) {
  .table-header {
    flex-wrap: wrap;
  }

  .table-toolbar input {
    font-size: 16px;
    min-height: 44px;
  }

  .table-row .cell-coord {
    display: none;
  }

  .cell-action .ghost {
    min-height: 40px;
  }
}
</style>
