<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { api, ApiError } from '../api';
import { GEOMETRY_TYPES, type Layer, type ObjectType } from '../types';

const message = useMessage();
const dialog = useDialog();

const rows = ref<ObjectType[]>([]);
const layers = ref<Layer[]>([]);
const loading = ref(false);

const showModal = ref(false);
const editing = ref<ObjectType | null>(null);
const form = ref({
  code: '',
  name: '',
  layerId: null as number | null,
  geometryType: 'point' as (typeof GEOMETRY_TYPES)[number],
  color: '#2e7d32',
  icon: '',
  lineWidth: null as number | null,
  attrsSchema: '{}',
  isActive: true,
  sortOrder: 0,
});
const saving = ref(false);

const geometryOptions = GEOMETRY_TYPES.map((g) => ({ label: g, value: g }));

async function load() {
  loading.value = true;
  try {
    [rows.value, layers.value] = await Promise.all([
      api.objectTypes.list(),
      api.layers.list(),
    ]);
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка загрузки');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value = {
    code: '',
    name: '',
    layerId: null,
    geometryType: 'point',
    color: '#2e7d32',
    icon: '',
    lineWidth: null,
    attrsSchema: '{}',
    isActive: true,
    sortOrder: 0,
  };
  showModal.value = true;
}

function openEdit(row: ObjectType) {
  editing.value = row;
  form.value = {
    code: row.code,
    name: row.name,
    layerId: row.layerId,
    geometryType: row.geometryType,
    color: row.color || '',
    icon: row.icon || '',
    lineWidth: row.lineWidth,
    attrsSchema: JSON.stringify(row.attrsSchema || {}, null, 2),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
  showModal.value = true;
}

function parseAttrsSchema(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(form.value.attrsSchema || '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('schema must be a JSON object');
    }
    return parsed;
  } catch (e) {
    message.error(`Некорректный JSON attrsSchema: ${e instanceof Error ? e.message : e}`);
    return null as unknown as Record<string, unknown>;
  }
}

async function save() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    message.warning('Заполните код и название');
    return;
  }
  const attrsSchema = parseAttrsSchema();
  if (!attrsSchema) {
    return;
  }

  saving.value = true;
  const payload = {
    name: form.value.name,
    layerId: form.value.layerId,
    geometryType: form.value.geometryType,
    color: form.value.color || null,
    icon: form.value.icon || null,
    lineWidth: form.value.lineWidth,
    attrsSchema,
    isActive: form.value.isActive,
    sortOrder: form.value.sortOrder,
  };
  try {
    if (editing.value) {
      await api.objectTypes.update(editing.value.id, payload);
      message.success('Тип обновлён');
    } else {
      await api.objectTypes.create({ code: form.value.code, ...payload });
      message.success('Тип создан');
    }
    showModal.value = false;
    await load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : 'Ошибка сохранения');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: ObjectType) {
  dialog.warning({
    title: 'Удалить тип?',
    content: `${row.name} (${row.code})`,
    positiveText: 'Удалить',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      try {
        await api.objectTypes.remove(row.id);
        message.success('Тип удалён');
        await load();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : 'Ошибка удаления');
      }
    },
  });
}

function layerName(id: number | null): string {
  return layers.value.find((l) => l.id === id)?.name || '—';
}

const columns: DataTableColumns<ObjectType> = [
  { title: 'Код', key: 'code', width: 120 },
  { title: 'Название', key: 'name' },
  {
    title: 'Слой',
    key: 'layerId',
    width: 120,
    render: (row) => layerName(row.layerId),
  },
  { title: 'Геометрия', key: 'geometryType', width: 110 },
  {
    title: 'Цвет',
    key: 'color',
    width: 80,
    render: (row) =>
      row.color ? h('span', { style: { color: row.color } }, row.color) : '—',
  },
  {
    title: 'Активен',
    key: 'isActive',
    width: 90,
    render: (row) => (row.isActive ? 'да' : 'нет'),
  },
  {
    title: 'Действия',
    key: 'actions',
    width: 140,
    render: (row) =>
      h('div', { style: { display: 'flex', gap: '8px' } }, [
        h(
          'a',
          { href: 'javascript:;', onClick: () => openEdit(row) },
          'Изменить',
        ),
        h(
          'a',
          { href: 'javascript:;', style: { color: '#d03050' }, onClick: () => confirmDelete(row) },
          'Удалить',
        ),
      ]),
  },
];

onMounted(load);
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Типы объектов</h2>
      <n-button type="primary" @click="openCreate">Добавить тип</n-button>
    </div>

    <n-data-table :columns="columns" :data="rows" :loading="loading" />

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editing ? 'Изменить тип' : 'Новый тип'"
      style="width: 560px"
    >
      <n-form label-placement="top">
        <n-form-item label="Код">
          <n-input v-model:value="form.code" :disabled="!!editing" placeholder="например: pole" />
        </n-form-item>
        <n-form-item label="Название">
          <n-input v-model:value="form.name" placeholder="например: Столб" />
        </n-form-item>
        <n-form-item label="Слой">
          <n-select
            v-model:value="form.layerId"
            :options="layers.map((l) => ({ label: l.name, value: l.id }))"
            clearable
            placeholder="Без слоя"
          />
        </n-form-item>
        <n-form-item label="Тип геометрии">
          <n-select v-model:value="form.geometryType" :options="geometryOptions" />
        </n-form-item>
        <n-form-item label="Цвет">
          <n-color-picker v-model:value="form.color" :show-alpha="false" />
        </n-form-item>
        <n-form-item label="Иконка">
          <n-input v-model:value="form.icon" placeholder="marker / home / ..." />
        </n-form-item>
        <n-form-item label="Толщина линии">
          <n-input-number v-model:value="form.lineWidth" :min="1" :max="20" />
        </n-form-item>
        <n-form-item label="Схема атрибутов (JSON Schema)">
          <n-input
            v-model:value="form.attrsSchema"
            type="textarea"
            :rows="8"
            placeholder='{"type":"object","properties":{...}}'
          />
        </n-form-item>
        <n-form-item label="Порядок сортировки">
          <n-input-number v-model:value="form.sortOrder" :min="0" />
        </n-form-item>
        <n-form-item label="Активен">
          <n-switch v-model:value="form.isActive" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="showModal = false">Отмена</n-button>
          <n-button type="primary" :loading="saving" @click="save">Сохранить</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar h2 {
  margin: 0;
}
</style>
