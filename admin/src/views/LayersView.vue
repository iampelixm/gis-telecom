<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { api, ApiError } from '../api';
import type { Layer } from '../types';

const message = useMessage();
const dialog = useDialog();

const rows = ref<Layer[]>([]);
const loading = ref(false);

const showModal = ref(false);
const editing = ref<Layer | null>(null);
const form = ref({ code: '', name: '', color: '#2e7d32', icon: '', sortOrder: 0, isActive: true });
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    rows.value = await api.layers.list();
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка загрузки');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value = { code: '', name: '', color: '#2e7d32', icon: '', sortOrder: 0, isActive: true };
  showModal.value = true;
}

function openEdit(row: Layer) {
  editing.value = row;
  form.value = {
    code: row.code,
    name: row.name,
    color: row.color || '',
    icon: row.icon || '',
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
  showModal.value = true;
}

async function save() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    message.warning('Заполните код и название');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await api.layers.update(editing.value.id, {
        name: form.value.name,
        color: form.value.color || null,
        icon: form.value.icon || null,
        sortOrder: form.value.sortOrder,
        isActive: form.value.isActive,
      });
    } else {
      await api.layers.create(form.value);
    }
    message.success(editing.value ? 'Слой обновлён' : 'Слой создан');
    showModal.value = false;
    await load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : 'Ошибка сохранения');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: Layer) {
  dialog.warning({
    title: 'Удалить слой?',
    content: `${row.name} (${row.code})`,
    positiveText: 'Удалить',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      try {
        await api.layers.remove(row.id);
        message.success('Слой удалён');
        await load();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : 'Ошибка удаления');
      }
    },
  });
}

const columns: DataTableColumns<Layer> = [
  { title: 'Код', key: 'code', width: 120 },
  { title: 'Название', key: 'name' },
  {
    title: 'Цвет',
    key: 'color',
    width: 80,
    render: (row) =>
      row.color ? h('span', { style: { color: row.color } }, row.color) : '—',
  },
  { title: 'Иконка', key: 'icon', width: 90 },
  { title: 'Порядок', key: 'sortOrder', width: 90 },
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
      <h2>Слои</h2>
      <n-button type="primary" @click="openCreate">Добавить слой</n-button>
    </div>

    <n-data-table :columns="columns" :data="rows" :loading="loading" />

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editing ? 'Изменить слой' : 'Новый слой'"
      style="width: 480px"
    >
      <n-form label-placement="top">
        <n-form-item label="Код">
          <n-input v-model:value="form.code" :disabled="!!editing" placeholder="например: poles" />
        </n-form-item>
        <n-form-item label="Название">
          <n-input v-model:value="form.name" placeholder="например: Столбы" />
        </n-form-item>
        <n-form-item label="Цвет">
          <n-color-picker v-model:value="form.color" :show-alpha="false" />
        </n-form-item>
        <n-form-item label="Иконка">
          <n-input v-model:value="form.icon" placeholder="marker / home / ..." />
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
