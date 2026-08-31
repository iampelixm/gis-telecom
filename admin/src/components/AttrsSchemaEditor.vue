<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMessage } from 'naive-ui';

interface FieldRow {
  key: string;
  widget: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'textarea' | 'select';
  enumText: string;
  min: number | null;
  max: number | null;
  required: boolean;
}

const props = defineProps<{ modelValue: Record<string, unknown> }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, unknown>): void }>();

const message = useMessage();

const WIDGET_OPTIONS = [
  { label: 'Строка', value: 'string' },
  { label: 'Число', value: 'number' },
  { label: 'Целое', value: 'integer' },
  { label: 'Да/Нет', value: 'boolean' },
  { label: 'Дата', value: 'date' },
  { label: 'Многострочный текст', value: 'textarea' },
  { label: 'Выбор из списка', value: 'select' },
];

const mode = ref<'editor' | 'json'>('editor');
const fields = ref<FieldRow[]>([]);
const jsonText = ref('');
const jsonError = ref('');

function widgetOf(def: Record<string, unknown>): FieldRow['widget'] {
  if (Array.isArray(def.enum) && def.enum.length > 0) {
    return 'select';
  }
  if (def.type === 'boolean') {
    return 'boolean';
  }
  if (def.type === 'number') {
    return 'number';
  }
  if (def.type === 'integer') {
    return 'integer';
  }
  if (def.format === 'date') {
    return 'date';
  }
  if (def.format === 'textarea') {
    return 'textarea';
  }
  return 'string';
}

function schemaToFields(schema: Record<string, unknown>): FieldRow[] {
  const propsObj = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];
  return Object.entries(propsObj).map(([key, def]) => ({
    key,
    widget: widgetOf(def),
    enumText: Array.isArray(def.enum) ? def.enum.join(', ') : '',
    min: typeof def.minimum === 'number' ? (def.minimum as number) : null,
    max: typeof def.maximum === 'number' ? (def.maximum as number) : null,
    required: required.includes(key),
  }));
}

function syncFromSchema() {
  fields.value = schemaToFields(props.modelValue || {});
}

function defFor(field: FieldRow): Record<string, unknown> {
  const def: Record<string, unknown> = {};
  switch (field.widget) {
    case 'number':
      def.type = 'number';
      if (field.min !== null) def.minimum = field.min;
      if (field.max !== null) def.maximum = field.max;
      break;
    case 'integer':
      def.type = 'integer';
      if (field.min !== null) def.minimum = field.min;
      if (field.max !== null) def.maximum = field.max;
      break;
    case 'boolean':
      def.type = 'boolean';
      break;
    case 'date':
      def.type = 'string';
      def.format = 'date';
      break;
    case 'textarea':
      def.type = 'string';
      def.format = 'textarea';
      break;
    case 'select':
      def.type = 'string';
      def.enum = field.enumText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    default:
      def.type = 'string';
  }
  return def;
}

function buildSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of fields.value) {
    const key = field.key.trim();
    if (!key) {
      continue;
    }
    properties[key] = defFor(field);
    if (field.required) {
      required.push(key);
    }
  }
  return {
    type: 'object',
    ...(required.length ? { required } : {}),
    properties,
    additionalProperties: true,
  };
}

function emitSchema() {
  emit('update:modelValue', buildSchema());
}

function addField() {
  fields.value.push({
    key: '',
    widget: 'string',
    enumText: '',
    min: null,
    max: null,
    required: false,
  });
}

function removeField(index: number) {
  fields.value.splice(index, 1);
  emitSchema();
}

function onFieldChanged() {
  const keys = fields.value.map((f) => f.key.trim());
  const dup = keys.find((k, i) => k && keys.indexOf(k) !== i);
  if (dup) {
    message.warning(`Дублируется имя поля: ${dup}`);
  }
  emitSchema();
}

function switchMode(next: 'editor' | 'json') {
  if (next === 'json') {
    jsonText.value = JSON.stringify(props.modelValue || {}, null, 2);
    jsonError.value = '';
  } else {
    try {
      const parsed = JSON.parse(jsonText.value);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('schema must be a JSON object');
      }
      emit('update:modelValue', parsed as Record<string, unknown>);
      jsonError.value = '';
    } catch (e) {
      jsonError.value = `Некорректный JSON: ${e instanceof Error ? e.message : e}`;
    }
  }
  mode.value = next;
}

function onJsonInput() {
  try {
    const parsed = JSON.parse(jsonText.value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('schema must be a JSON object');
    }
    emit('update:modelValue', parsed as Record<string, unknown>);
    jsonError.value = '';
  } catch (e) {
    jsonError.value = `Некорректный JSON: ${e instanceof Error ? e.message : e}`;
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (mode.value === 'editor') {
      syncFromSchema();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="attrs-editor">
    <n-radio-group
      v-model:value="mode"
      size="small"
      style="margin-bottom: 8px"
      @update:value="(v: 'editor' | 'json') => switchMode(v)"
    >
      <n-radio-button value="editor">Редактор полей</n-radio-button>
      <n-radio-button value="json">JSON Schema</n-radio-button>
    </n-radio-group>

    <template v-if="mode === 'editor'">
      <div class="field-list">
        <div v-for="(field, i) in fields" :key="i" class="field-row">
          <n-input
            v-model:value="field.key"
            placeholder="имя поля"
            style="width: 120px"
            @update:value="onFieldChanged"
          />
          <n-select
            v-model:value="field.widget"
            :options="WIDGET_OPTIONS"
            style="width: 150px"
            @update:value="onFieldChanged"
          />
          <n-input
            v-if="field.widget === 'select'"
            v-model:value="field.enumText"
            placeholder="значения через запятую"
            style="flex: 1"
            @update:value="onFieldChanged"
          />
          <template v-if="field.widget === 'number' || field.widget === 'integer'">
            <n-input-number
              v-model:value="field.min"
              placeholder="min"
              style="width: 80px"
              @update:value="onFieldChanged"
            />
            <n-input-number
              v-model:value="field.max"
              placeholder="max"
              style="width: 80px"
              @update:value="onFieldChanged"
            />
          </template>
          <span v-if="field.widget === 'date'" class="field-hint">дата (YYYY-MM-DD)</span>
          <span v-if="field.widget === 'textarea'" class="field-hint">многострочный текст</span>
          <n-checkbox
            v-model:checked="field.required"
            class="field-required"
            @update:checked="onFieldChanged"
          >
            обязательное
          </n-checkbox>
          <n-button size="small" quaternary circle type="error" @click="removeField(i)">
            ✕
          </n-button>
        </div>
      </div>
      <n-button size="small" dashed style="width: 100%" @click="addField">
        + Добавить поле
      </n-button>
    </template>

    <template v-else>
      <n-input
        v-model:value="jsonText"
        type="textarea"
        :rows="10"
        placeholder='{"type":"object","properties":{...}}'
        @update:value="onJsonInput"
      />
      <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
    </template>
  </div>
</template>

<style scoped>
.attrs-editor {
  width: 100%;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-hint {
  flex: 1;
  font-size: 12px;
  color: #888;
}

.field-required {
  flex: none;
}

.json-error {
  margin-top: 6px;
  color: #d03050;
  font-size: 13px;
}
</style>
