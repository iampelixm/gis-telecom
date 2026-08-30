<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { api, ApiError } from '../api';
import type { ObjectType, RelationType } from '../types';

const message = useMessage();
const dialog = useDialog();

const rows = ref<RelationType[]>([]);
const types = ref<ObjectType[]>([]);
const loading = ref(false);

const showModal = ref(false);
const editing = ref<RelationType | null>(null);
const form = ref({
  code: '',
  name: '',
  fromTypeId: null as number | null,
  toTypeId: null as number | null,
  isActive: true,
});
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    [rows.value, types.value] = await Promise.all([
      api.relationTypes.list(),
      api.objectTypes.list(),
    ]);
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка загрузки');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value = { code: '', name: '', fromTypeId: null, toTypeId: null, isActive: true };
  showModal.value = true;
}

function openEdit(row: RelationType) {
  editing.value = row;
  form.value = {
    code: row.code,
    name: row.name,
    fromTypeId: row.fromTypeId,
    toTypeId: row.toTypeId,
    isActive: row.isActive,
  };
  showModal.value = true;
}

async function save() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    message.warning('Заполните код и название');
    return;
  }
  if (!form.value.fromTypeId || !form.value.toTypeId) {
    message.warning('Выберите типы «из» и «в»');
    return;
  }
  if (form.value.fromTypeId === form.value.toTypeId) {
    message.warning('Типы «из» и «в» не должны совпадать');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await api.relationTypes.update(editing.value.id, {
        name: form.value.name,
        fromTypeId: form.value.fromTypeId,
        toTypeId: form.value.toTypeId,
        isActive: form.value.isActive,
      });
      message.success('Тип связи обновлён');
    } else {
      await api.relationTypes.create(form.value);
      message.success('Тип связи создан');
    }
    showModal.value = false;
    await load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : 'Ошибка сохранения');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: RelationType) {
  dialog.warning({
    title: 'Удалить тип связи?',
    content: `${row.name} (${row.code})`,
    positiveText: 'Удалить',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      try {
        await api.relationTypes.remove(row.id);
        message.success('Тип связи удалён');
        await load();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : 'Ошибка удаления');
      }
    },
  });
}

function typeName(id: number): string {
  return types.value.find((t) => t.id === id)?.name || String(id);
}

const columns: DataTableColumns<RelationType> = [
  { title: 'Код', key: 'code', width: 150 },
  { title: 'Название', key: 'name' },
  {
    title: 'Из',
    key: 'fromTypeId',
    width: 140,
    render: (row) => typeName(row.fromTypeId),
  },
  {
    title: 'В',
    key: 'toTypeId',
    width: 140,
    render: (row) => typeName(row.toTypeId),
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
      <h2>Типы связей</h2>
      <n-button type="primary" @click="openCreate">Добавить тип связи</n-button>
    </div>

    <n-data-table :columns="columns" :data="rows" :loading="loading" />

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editing ? 'Изменить тип связи' : 'Новый тип связи'"
      style="width: 480px"
    >
      <n-form label-placement="top">
        <n-form-item label="Код">
          <n-input v-model:value="form.code" :disabled="!!editing" placeholder="например: fiber_line_pole" />
        </n-form-item>
        <n-form-item label="Название">
          <n-input v-model:value="form.name" placeholder="например: Линия → столб" />
        </n-form-item>
        <n-form-item label="Тип «из»">
          <n-select
            v-model:value="form.fromTypeId"
            :options="types.map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))"
          />
        </n-form-item>
        <n-form-item label="Тип «в»">
          <n-select
            v-model:value="form.toTypeId"
            :options="types.map((t) => ({ label: `${t.name} (${t.code})`, value: t.id }))"
          />
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
