<script setup>
import { onMounted, onBeforeUnmount, ref, computed, reactive } from 'vue';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Geoman } from '@geoman-io/maplibre-geoman-free';
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
import { api } from '../api';
import { auth } from '../auth';

const mapContainer = ref(null);
const layers = ref([]);
const types = ref([]);
const visible = ref({});

const TILES_URL = import.meta.env.VITE_TILES_URL || '/tiles';

let map = null;
let gm = null;

const creatingType = ref(null);
const editingObjectId = ref(null);
const editingTypeCode = ref(null);
const selected = ref(null);
const modal = reactive({
  mode: null, // 'create' | 'edit'
  title: '',
  objectId: null,
  typeCode: null,
  fields: [],
  values: {},
  error: '',
});
const saving = ref(false);

const grouped = computed(() =>
  layers.value
    .map((layer) => ({
      ...layer,
      types: types.value.filter((t) => t.layerId === layer.id),
    }))
    .filter((g) => g.types.length > 0),
);

const user = computed(() => auth.state.user);

const SHAPE_BY_GEOM = {
  point: 'marker',
  linestring: 'line',
  polygon: 'polygon',
  multipoint: 'marker',
  multilinestring: 'line',
  multipolygon: 'polygon',
};

function layerForType(t) {
  return `objects-${t.code}`;
}

function sourceForType() {
  return 'src-objects';
}

function shapeForType(t) {
  return SHAPE_BY_GEOM[t.geometryType] || 'marker';
}

function schemaFields(t) {
  const schema = t.attrsSchema || {};
  const props = schema.properties || {};
  const required = schema.required || [];
  return Object.entries(props).map(([key, def]) => ({
    key,
    label: key.replace(/_/g, ' '),
    type: def.type || 'string',
    enum: def.enum || null,
    required: required.includes(key),
  }));
}

async function loadCatalog() {
  const [layersRes, typesRes] = await Promise.all([
    api.layers.list(),
    api.objectTypes.list(),
  ]);
  layers.value = layersRes.filter((l) => l.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  types.value = typesRes.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const initial = {};
  for (const t of types.value) {
    initial[t.code] = auth.hasObjectRead(t.code);
  }
  visible.value = initial;

  addObjectLayers();
  initGeoman();
}

function addObjectLayers() {
  if (!map.getSource(sourceForType())) {
    map.addSource(sourceForType(), {
      type: 'vector',
      tiles: [`${TILES_URL}/objects/{z}/{x}/{y}`],
      maxzoom: 22,
    });
  }
  for (const t of types.value) {
    const layerId = layerForType(t);
    if (!map.getLayer(layerId)) {
      map.addLayer(makeLayer(t));
    }
  }
}

function makeLayer(t) {
  const color = t.color || '#333333';
  const geom = t.geometryType;
  const layout = { visibility: visible.value[t.code] ? 'visible' : 'none' };
  const base = {
    id: layerForType(t),
    source: sourceForType(),
    'source-layer': 'objects',
    filter: ['==', 'type', t.code],
    layout,
  };
  if (geom === 'point' || geom === 'multipoint') {
    return {
      ...base,
      type: 'circle',
      paint: {
        'circle-radius': 6,
        'circle-color': color,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    };
  }
  if (geom === 'linestring' || geom === 'multilinestring') {
    return {
      ...base,
      type: 'line',
      paint: {
        'line-color': color,
        'line-width': t.lineWidth || 2,
      },
    };
  }
  return {
    ...base,
    type: 'fill',
    paint: {
      'fill-color': color,
      'fill-opacity': 0.35,
      'fill-outline-color': color,
    },
  };
}

function toggleType(t) {
  visible.value[t.code] = !visible.value[t.code];
  const layerId = layerForType(t);
  const layer = map?.getLayer(layerId);
  if (layer) {
    map.setLayoutProperty(
      layerId,
      'visibility',
      visible.value[t.code] ? 'visible' : 'none',
    );
  }
}

function initGeoman() {
  gm = new Geoman(map, {
    settings: { useControlsUi: false },
  });
  map.on('gm:create', onFeatureCreated);
  map.on('gm:dragend', onFeatureEditEnd);
  map.on('gm:editend', onFeatureEditEnd);
  map.on('gm:changeend', onFeatureEditEnd);
}

function typeByCode(code) {
  return types.value.find((t) => t.code === code);
}

function startCreate(t) {
  if (!auth.hasObjectWrite(t.code)) {
    return;
  }
  creatingType.value = t;
  gm.enableDraw(shapeForType(t));
}

function cancelDraw() {
  gm.disableDraw();
  gm.features.deleteAll();
  creatingType.value = null;
}

async function onFeatureCreated(e) {
  const t = creatingType.value;
  if (!t) {
    return;
  }
  const feature = e.feature;
  const geometry = feature?.getGeoJson()?.geometry;
  if (!geometry) {
    return;
  }
  const fields = schemaFields(t);
  if (fields.some((f) => f.required)) {
    openModal('create', t, geometry, feature);
  } else {
    await saveObject({ type: t.code, geometry, attrs: {} });
    cleanupCreated();
  }
}

function openModal(mode, t, geometry, feature) {
  modal.mode = mode;
  modal.title = mode === 'create' ? `Создать: ${t.name}` : `Свойства: ${t.name}`;
  modal.typeCode = t.code;
  modal.objectId = null;
  modal.geometry = geometry || null;
  modal.feature = feature || null;
  modal.fields = schemaFields(t);
  modal.values = {};
  modal.error = '';
  for (const f of modal.fields) {
    if (f.type === 'integer' || f.type === 'number') {
      modal.values[f.key] = f.type === 'integer' ? 0 : 0;
    }
  }
}

async function saveObject(payload) {
  try {
    await api.objects.create(payload);
    modal.error = '';
    return true;
  } catch (err) {
    modal.error = err?.message || String(err);
    return false;
  }
}

function cleanupCreated() {
  gm.disableDraw();
  gm.features.deleteAll();
  creatingType.value = null;
  modal.mode = null;
  recreateObjectSource();
}

async function submitCreate() {
  if (!modal.geometry) {
    return;
  }
  saving.value = true;
  const ok = await saveObject({
    type: modal.typeCode,
    geometry: modal.geometry,
    attrs: modal.values,
  });
  saving.value = false;
  if (ok) {
    cleanupCreated();
  }
}

let lastEditEndAt = 0;
let lastEditEndObjectId = null;

async function onFeatureEditEnd(e) {
  const objectId = editingObjectId.value;
  if (objectId === null) {
    return;
  }
  const now = Date.now();
  if (objectId === lastEditEndObjectId && now - lastEditEndAt < 800) {
    return;
  }
  const feature = e.feature || e.targetFeatures?.[0];
  const geometry = feature?.getGeoJson()?.geometry;
  if (!geometry) {
    return;
  }
  lastEditEndAt = now;
  lastEditEndObjectId = objectId;
  try {
    await api.objects.update(objectId, { geometry });
  } catch (err) {
    console.error('failed to update geometry', err);
  }
}

function finishEditing() {
  gm.disableGlobalEditMode();
  gm.disableGlobalDragMode();
  gm.features.deleteAll();
  const code = editingTypeCode.value;
  editingObjectId.value = null;
  editingTypeCode.value = null;
  if (code) {
    const layerId = layerForType(typeByCode(code));
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
    }
  }
  recreateObjectSource();
}

async function removeEditingObject() {
  if (editingObjectId.value === null) {
    return;
  }
  if (!window.confirm('Удалить объект?')) {
    return;
  }
  const id = editingObjectId.value;
  const code = editingTypeCode.value;
  try {
    await api.objects.remove(id);
    finishEditing();
  } catch (err) {
    console.error('failed to delete object', err);
  }
}

async function onMapClick(e) {
  if (creatingType.value || editingObjectId.value !== null || !gm?.loaded) {
    return;
  }
  const ids = types.value
    .filter((t) => auth.hasObjectWrite(t.code) && auth.hasObjectRead(t.code))
    .map((t) => layerForType(t));
  const r = 4;
  const feats = map.queryRenderedFeatures(
    [
      [e.point.x - r, e.point.y - r],
      [e.point.x + r, e.point.y + r],
    ],
    { layers: ids },
  );
  if (!feats.length) {
    return;
  }
  const PRIORITY = { point: 0, multipoint: 0, linestring: 1, multilinestring: 1, polygon: 2, multipolygon: 2 };
  let best = feats[0];
  let bestPrio = 99;
  for (const f of feats) {
    const t = typeByCode(f.properties?.type);
    const prio = t ? PRIORITY[t.geometryType] ?? 99 : 99;
    if (prio < bestPrio) {
      bestPrio = prio;
      best = f;
    }
  }
  const props = best.properties || {};
  const id = props.id;
  const typeCode = props.type;
  if (id == null || !typeCode) {
    return;
  }
  await editObject(Number(id), typeCode);
}

async function editObject(id, typeCode) {
  try {
    const row = await api.objects.get(id);
    const t = typeByCode(typeCode);
    editingObjectId.value = id;
    editingTypeCode.value = typeCode;
    const layerId = layerForType(t);
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
    await gm.features.importGeoJson(
      {
        type: 'Feature',
        properties: { id, shape: shapeForType(t) },
        geometry: row.geometry,
      },
      { idPropertyName: 'id' },
    );
    if (shapeForType(t) === 'marker') {
      await gm.enableGlobalDragMode();
    } else {
      await gm.enableGlobalEditMode();
    }
  } catch (err) {
    console.error('failed to start editing', err);
    finishEditing();
  }
}

function showObject(id, typeCode) {
  api.objects
    .get(id)
    .then((row) => {
      const t = typeByCode(typeCode);
      if (!t) {
        return;
      }
      modal.mode = 'edit';
      modal.title = `Свойства: ${t.name}`;
      modal.typeCode = typeCode;
      modal.objectId = id;
      modal.geometry = row.geometry;
      modal.fields = schemaFields(t);
      modal.values = { ...(row.attrs || {}) };
      modal.error = '';
    })
    .catch((err) => {
      modal.mode = 'edit';
      modal.title = 'Ошибка';
      modal.fields = [];
      modal.values = {};
      modal.error = err?.message || String(err);
    });
}

async function submitAttrs() {
  if (modal.objectId === null) {
    return;
  }
  saving.value = true;
  try {
    await api.objects.update(modal.objectId, { attrs: modal.values });
    modal.mode = null;
    recreateObjectSource();
  } catch (err) {
    modal.error = err?.message || String(err);
  } finally {
    saving.value = false;
  }
}

async function removeObject() {
  if (modal.objectId === null) {
    return;
  }
  if (!window.confirm('Удалить объект?')) {
    return;
  }
  saving.value = true;
  try {
    await api.objects.remove(modal.objectId);
    modal.mode = null;
    recreateObjectSource();
  } catch (err) {
    modal.error = err?.message || String(err);
  } finally {
    saving.value = false;
  }
}

function closeModal() {
  modal.mode = null;
  modal.error = '';
}

function showObjectGeometry() {
  const id = modal.objectId;
  const code = modal.typeCode;
  closeModal();
  editObject(id, code);
}

function recreateObjectSource() {
  const srcId = sourceForType();
  for (const t of types.value) {
    const lid = layerForType(t);
    if (map.getLayer(lid)) {
      map.removeLayer(lid);
    }
  }
  if (map.getSource(srcId)) {
    map.removeSource(srcId);
  }
  addObjectLayers();
}

function logout() {
  auth.logout();
}

onMounted(async () => {
  maplibregl.setWorkerUrl(workerUrl);
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
        },
      ],
    },
    center: [39.745, 43.614],
    zoom: 14,
    transformRequest: (url) => {
      if (!url.includes('/tiles/') || !auth.state.token) {
        return;
      }
      return {
        url: new URL(url, window.location.href).href,
        headers: { Authorization: `Bearer ${auth.state.token}` },
      };
    },
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.on('load', loadCatalog);
  map.on('click', onMapClick);
});

onBeforeUnmount(() => {
  if (gm) {
    map.off('gm:create', onFeatureCreated);
    map.off('gm:dragend', onFeatureEditEnd);
    map.off('gm:editend', onFeatureEditEnd);
    map.off('gm:changeend', onFeatureEditEnd);
    gm.destroy({ removeSources: true });
  }
  map?.remove();
});
</script>

<template>
  <div class="map-shell">
    <div ref="mapContainer" class="map"></div>

    <aside class="panel">
      <div class="panel-header">
        <strong>{{ user?.name || user?.sub }}</strong>
        <button class="logout" @click="logout">Выйти</button>
      </div>
      <div class="panel-body">
        <div
          v-for="g in grouped"
          :key="g.code"
          class="layer-group"
        >
          <div class="layer-name">
            <span class="dot" :style="{ background: g.color || '#888' }"></span>
            {{ g.name }}
          </div>
          <label
            v-for="t in g.types"
            :key="t.code"
            class="type-toggle"
          >
            <input
              type="checkbox"
              :checked="visible[t.code]"
              :disabled="!auth.hasObjectRead(t.code)"
              @change="toggleType(t)"
            />
            <span class="dot" :style="{ background: t.color || g.color || '#888' }"></span>
            {{ t.name }}
            <button
              v-if="auth.hasObjectWrite(t.code)"
              class="add-btn"
              :class="{ active: creatingType?.code === t.code }"
              :disabled="creatingType !== null"
              title="Добавить объект"
              @click.prevent="startCreate(t)"
            >+</button>
          </label>
        </div>
      </div>
      <div v-if="creatingType" class="draw-bar">
        <span>Кликните на карту, чтобы нарисовать «{{ creatingType.name }}»</span>
        <button @click="cancelDraw">Отмена</button>
      </div>
      <div v-if="editingObjectId !== null" class="draw-bar">
        <span>Измените геометрию (Enter — сохранить)</span>
        <button @click="finishEditing">Готово</button>
        <button
          v-if="auth.hasObjectWrite(editingTypeCode)"
          class="danger"
          @click="removeEditingObject"
        >Удалить</button>
      </div>
    </aside>

    <div v-if="modal.mode" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <strong>{{ modal.title }}</strong>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div v-if="modal.error" class="modal-error">{{ modal.error }}</div>
        <form
          v-if="modal.mode === 'create'"
          class="modal-body"
          @submit.prevent="submitCreate"
        >
          <label v-for="f in modal.fields" :key="f.key" class="field">
            <span class="field-label">
              {{ f.label }}<i v-if="f.required" class="req">*</i>
            </span>
            <select
              v-if="f.enum"
              v-model="modal.values[f.key]"
            >
              <option v-for="opt in f.enum" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else
              v-model="modal.values[f.key]"
              :type="f.type === 'integer' || f.type === 'number' ? 'number' : 'text'"
            />
          </label>
          <button
            type="submit"
            class="primary"
            :disabled="saving"
          >
            {{ saving ? 'Сохранение…' : 'Создать' }}
          </button>
        </form>
        <div v-else-if="modal.mode === 'edit'" class="modal-body">
          <label v-for="f in modal.fields" :key="f.key" class="field">
            <span class="field-label">{{ f.label }}</span>
            <select
              v-if="f.enum"
              v-model="modal.values[f.key]"
            >
              <option v-for="opt in f.enum" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else
              v-model="modal.values[f.key]"
              :type="f.type === 'integer' || f.type === 'number' ? 'number' : 'text'"
            />
          </label>
          <div class="modal-actions">
            <button
              class="primary"
              :disabled="saving"
              @click="submitAttrs"
            >
              {{ saving ? 'Сохранение…' : 'Сохранить' }}
            </button>
            <button
              class="danger"
              :disabled="saving"
              @click="removeObject"
            >
              Удалить
            </button>
            <button
              class="primary"
              :disabled="saving || editingObjectId !== null"
              @click="showObjectGeometry"
            >
              Изменить геометрию
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
}

.panel {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 240px;
  max-height: calc(100% - 20px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #111827;
  color: #fff;
  font-size: 14px;
}

.logout {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
}

.logout:hover {
  color: #fff;
}

.panel-body {
  overflow-y: auto;
  padding: 8px 12px;
}

.layer-group {
  margin-bottom: 12px;
}

.layer-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.type-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  padding: 2px 0;
  cursor: pointer;
}

.type-toggle input:disabled {
  cursor: not-allowed;
}

.add-btn {
  margin-left: auto;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: #e5e7eb;
  color: #374151;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}

.add-btn:hover {
  background: #d1d5db;
}

.add-btn.active {
  background: #111827;
  color: #fff;
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.draw-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: #fef3c7;
  border-top: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
}

.draw-bar button {
  border: none;
  background: #92400e;
  color: #fff;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  flex: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.modal {
  width: 360px;
  max-width: calc(100% - 32px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #111827;
  color: #fff;
  font-size: 14px;
}

.modal-close {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: #fff;
}

.modal-error {
  padding: 8px 16px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
}

.modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 13px;
  color: #374151;
}

.req {
  color: #dc2626;
  font-style: normal;
  margin-left: 2px;
}

.field input,
.field select {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 8px;
}

button.primary,
button.danger {
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: #fff;
}

button.primary {
  background: #111827;
}

button.danger {
  background: #dc2626;
}

button.primary:disabled,
button.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
