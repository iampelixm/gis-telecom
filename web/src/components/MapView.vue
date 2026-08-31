<script setup>
import { onMounted, onBeforeUnmount, ref, computed, reactive } from 'vue';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Geoman } from '@geoman-io/maplibre-geoman-free';
import '@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css';
import { api } from '../api';
import { auth } from '../auth';
import ObjectsTable from './ObjectsTable.vue';
import EquipmentTable from './EquipmentTable.vue';

const mapContainer = ref(null);
const layers = ref([]);
const types = ref([]);
const visible = ref({});
const relationTypes = ref([]);
const relationVisible = ref({});
const expandedLayers = reactive({});
const layerCollapsed = reactive({});
const layerObjects = reactive({});
const layerObjectsLoading = reactive({});
const layerObjectsError = reactive({});
const searchQuery = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const fabOpen = ref(false);
const panelOpen = ref(true);
const tableMode = ref(false);
const equipOpen = ref(false);
const equipMode = ref('modal');
let searchDebounce = null;

const TILES_URL = import.meta.env.VITE_TILES_URL || '/tiles';

let map = null;
let gm = null;

const creatingType = ref(null);
const editingObjectId = ref(null);
const editingTypeCode = ref(null);
const selected = ref(null);
const creatingRelation = ref(false);
const relationFromOptions = ref([]);
const relationToOptions = ref([]);
const relForm = reactive({
  relationType: '',
  fromId: null,
  toId: null,
  attrsText: '',
  error: '',
});
const relModal = reactive({
  open: false,
  relation: null,
  relationTypeName: '',
  attrsText: '',
  saving: false,
  error: '',
});
const modal = reactive({
  mode: null, // 'create' | 'edit'
  title: '',
  objectId: null,
  typeCode: null,
  fields: [],
  values: {},
  error: '',
  owner: null,
});
const saving = ref(false);
const historyModal = reactive({
  open: false,
  title: '',
  entries: [],
  loading: false,
  error: '',
});

const geoSuggest = reactive({
  open: false,
  results: [],
  loading: false,
  error: '',
});
let geoDebounce = null;

const ACTION_LABELS = {
  created: 'Создание',
  updated: 'Изменение атрибутов',
  moved: 'Перемещение/правка геометрии',
  deleted: 'Удаление',
};

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function objectLabel(o) {
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

function geometryCenter(geom) {
  if (!geom) return null;
  if (geom.type === 'Point') {
    return geom.coordinates.slice(0, 2);
  }
  const coords = [];
  const collect = (c) => {
    if (Array.isArray(c[0])) {
      c.forEach(collect);
    } else {
      coords.push(c);
    }
  };
  collect(geom.coordinates || []);
  if (!coords.length) return null;
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

function currentBbox() {
  if (!map) return null;
  const b = map.getBounds();
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
}

function flyToObject(o) {
  const center = geometryCenter(o.geometry);
  if (center) {
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 16) });
  }
}

function focusObject(o) {
  flyToObject(o);
  showObject(o.id, o.typeCode);
}

async function loadLayerObjects(g) {
  const code = g.code;
  const bbox = currentBbox();
  const codes = g.types
    .filter((t) => visible.value[t.code] && auth.hasObjectRead(t.code))
    .map((t) => t.code);
  if (!bbox || codes.length === 0) {
    layerObjects[code] = [];
    layerObjectsLoading[code] = false;
    return;
  }
  layerObjectsLoading[code] = true;
  layerObjectsError[code] = '';
  try {
    const results = await Promise.all(
      codes.map((c) => api.objects.list({ type: c, bbox, limit: 500 })),
    );
    layerObjects[code] = results.flat().sort((a, b) => a.id - b.id);
  } catch (err) {
    layerObjectsError[code] = err?.message || String(err);
    layerObjects[code] = [];
  } finally {
    layerObjectsLoading[code] = false;
  }
}

function toggleLayerList(g) {
  const code = g.code;
  const opening = !expandedLayers[code];
  expandedLayers[code] = opening;
  if (opening) {
    loadLayerObjects(g);
  } else {
    layerObjects[code] = [];
    layerObjectsError[code] = '';
  }
}

function toggleLayerCollapse(g) {
  const code = g.code;
  layerCollapsed[code] = !layerCollapsed[code];
  if (layerCollapsed[code]) {
    expandedLayers[code] = false;
    layerObjects[code] = [];
    layerObjectsError[code] = '';
  }
}

function onSearchInput() {
  const q = searchQuery.value.trim();
  clearTimeout(searchDebounce);
  if (q.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
  searchDebounce = setTimeout(async () => {
    const readable = types.value.filter((t) => auth.hasObjectRead(t.code));
    try {
      const results = await Promise.all(
        readable.map((t) =>
          api.objects.list({ type: t.code, search: q, limit: 30 }),
        ),
      );
      searchResults.value = results
        .flat()
        .sort((a, b) => a.id - b.id)
        .slice(0, 30);
    } catch (err) {
      searchResults.value = [];
    } finally {
      searchLoading.value = false;
    }
  }, 300);
}

function pickSearchResult(o) {
  searchResults.value = [];
  searchQuery.value = '';
  focusObject(o);
}

function toggleFab() {
  fabOpen.value = !fabOpen.value;
}

function startCreateFromFab(t) {
  fabOpen.value = false;
  startCreate(t);
}

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

function fieldWidget(def) {
  if (def.enum) {
    return 'select';
  }
  if (def.type === 'boolean') {
    return 'checkbox';
  }
  if (def.type === 'integer' || def.type === 'number') {
    return 'number';
  }
  if (def.format === 'date') {
    return 'date';
  }
  if (def.format === 'textarea' || (def.type === 'string' && (def.minLength || 0) >= 100)) {
    return 'textarea';
  }
  return 'text';
}

function schemaFields(t) {
  const schema = t.attrsSchema || {};
  const props = schema.properties || {};
  const required = schema.required || [];
  return Object.entries(props).map(([key, def]) => {
    let widget = fieldWidget(def);
    if (t.code === 'house' && key === 'address' && def.type === 'string') {
      widget = 'geo';
    }
    return {
      key,
      label: key.replace(/_/g, ' '),
      type: def.type || 'string',
      widget,
      enum: def.enum || null,
      required: required.includes(key),
    };
  });
}

async function loadCatalog() {
  const [layersRes, typesRes, relTypesRes] = await Promise.all([
    api.layers.list(),
    api.objectTypes.list(),
    api.relationTypes.list(),
  ]);
  layers.value = layersRes.filter((l) => l.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  types.value = typesRes.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  relationTypes.value = relTypesRes
    .filter((r) => r.isActive)
    .sort((a, b) => a.id - b.id);

  const initial = {};
  for (const t of types.value) {
    initial[t.code] = auth.hasObjectRead(t.code);
  }
  visible.value = initial;

  const relInitial = {};
  for (const r of relationTypes.value) {
    relInitial[r.code] = auth.hasRelationRead(r.code);
  }
  relationVisible.value = relInitial;

  addObjectLayers();
  addRelationLayers();
  initGeoman();
  map.on('moveend', onMoveEnd);
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

const RELATION_SOURCE = 'src-relations';

function relationColor(r) {
  return r.fromType?.color || r.toType?.color || '#7c3aed';
}

function relationLayerFor(r) {
  return `relations-${r.code}`;
}

function addRelationLayers() {
  if (!map.getSource(RELATION_SOURCE)) {
    map.addSource(RELATION_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  for (const r of relationTypes.value) {
    const layerId = relationLayerFor(r);
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: RELATION_SOURCE,
        filter: ['==', 'relationType', r.code],
        layout: {
          visibility: relationVisible.value[r.code] ? 'visible' : 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': relationColor(r),
          'line-width': 2,
          'line-dasharray': [4, 3],
        },
      });
    }
  }
}

function toggleRelation(r) {
  relationVisible.value[r.code] = !relationVisible.value[r.code];
  const layerId = relationLayerFor(r);
  const layer = map?.getLayer(layerId);
  if (layer) {
    map.setLayoutProperty(
      layerId,
      'visibility',
      relationVisible.value[r.code] ? 'visible' : 'none',
    );
  }
}

async function reloadRelations() {
  if (!map) {
    return;
  }
  const codes = relationTypes.value
    .filter((r) => relationVisible.value[r.code] && auth.hasRelationRead(r.code))
    .map((r) => r.code);
  if (codes.length === 0) {
    setRelationData({ type: 'FeatureCollection', features: [] });
    return;
  }
  const b = map.getBounds();
  const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
  try {
    const fc = await api.relations.list({ type: codes.join(','), bbox });
    setRelationData(fc);
  } catch (err) {
    console.error('failed to load relations', err);
  }
}

function setRelationData(fc) {
  if (!map.getSource(RELATION_SOURCE)) {
    return;
  }
  map.getSource(RELATION_SOURCE).setData(fc);
}

function onMoveEnd() {
  reloadRelations();
  tableTick++;
}

let tableTick = 0;

function openTable() {
  tableMode.value = true;
}

function closeTable() {
  tableMode.value = false;
}

function openEquipment() {
  equipOpen.value = true;
}

function closeEquipment() {
  equipOpen.value = false;
}

function focusFromTable(o) {
  tableMode.value = false;
  equipOpen.value = false;
  focusObject(o);
}

function onEquipModeChange(m) {
  equipMode.value = m;
}

const equipmentTypes = computed(() => {
  const equipLayer = layers.value.find((l) => l.code === 'equipment');
  if (!equipLayer) {
    return types.value.filter((t) => t.code === 'equipment');
  }
  return types.value.filter((t) => t.layerId === equipLayer.id);
});

const bboxTick = computed(() => {
  if (!map) return '';
  const b = map.getBounds();
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}##${tableTick}`;
});

function relationTypeByCode(code) {
  return relationTypes.value.find((r) => r.code === code);
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
  closeGeo();
  for (const f of modal.fields) {
    if (f.widget === 'number') {
      modal.values[f.key] = 0;
    } else if (f.widget === 'checkbox') {
      modal.values[f.key] = false;
    } else if (f.widget === 'date') {
      modal.values[f.key] = '';
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
  const relLayerIds = relationTypes.value
    .filter((r) => auth.hasRelationRead(r.code) && relationVisible.value[r.code])
    .map((r) => relationLayerFor(r));
  const relFeats = map.queryRenderedFeatures(
    [
      [e.point.x - 6, e.point.y - 6],
      [e.point.x + 6, e.point.y + 6],
    ],
    { layers: relLayerIds },
  );
  if (relFeats.length) {
    openRelationModal(relFeats[0]);
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
      modal.owner = {
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      modal.error = '';
      closeGeo();
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

async function openHistory(entityType, entityId, title) {
  historyModal.open = true;
  historyModal.title = title;
  historyModal.entries = [];
  historyModal.loading = true;
  historyModal.error = '';
  try {
    historyModal.entries = await api.history(entityType, entityId);
  } catch (err) {
    historyModal.error = err?.message || String(err);
  } finally {
    historyModal.loading = false;
  }
}

function closeHistory() {
  historyModal.open = false;
  historyModal.entries = [];
  historyModal.error = '';
}

function closeModal() {
  modal.mode = null;
  modal.error = '';
  modal.owner = null;
  closeGeo();
}

function isHouseModal() {
  return modal.typeCode === 'house';
}

function isPointGeometry() {
  return modal.geometry?.type === 'Point';
}

async function onAddressInput() {
  const q = (modal.values.address || '').trim();
  if (q.length < 3) {
    geoSuggest.open = false;
    geoSuggest.results = [];
    return;
  }
  clearTimeout(geoDebounce);
  geoSuggest.loading = true;
  geoSuggest.error = '';
  geoDebounce = setTimeout(async () => {
    try {
      const res = await api.geo.suggest(q);
      geoSuggest.results = (res.suggestions || []).slice(0, 6);
      geoSuggest.open = geoSuggest.results.length > 0;
    } catch (err) {
      geoSuggest.error = err?.message || String(err);
      geoSuggest.open = false;
      geoSuggest.results = [];
    } finally {
      geoSuggest.loading = false;
    }
  }, 300);
}

function pickAddress(s) {
  modal.values.address = s.value;
  if (s.fiasId) {
    modal.values.fias_id = s.fiasId;
  }
  if (s.kladrId) {
    modal.values.kladr_id = s.kladrId;
  }
  if (s.lat != null && s.lon != null) {
    modal.values.address_normalized = s.value;
  }
  geoSuggest.open = false;
  geoSuggest.results = [];
}

async function reverseGeocode() {
  const g = modal.geometry;
  if (!g || g.type !== 'Point') {
    return;
  }
  const [lon, lat] = g.coordinates;
  geoSuggest.loading = true;
  geoSuggest.error = '';
  try {
    const r = await api.geo.reverse(lat, lon);
    if (!r) {
      geoSuggest.error = 'Не удалось определить адрес';
      return;
    }
    modal.values.address = r.address;
    if (r.fiasId) {
      modal.values.fias_id = r.fiasId;
    }
    if (r.kladrId) {
      modal.values.kladr_id = r.kladrId;
    }
    if (r.floors != null) {
      modal.values.floors = r.floors;
    }
    if (r.apartments != null) {
      modal.values.apartments = r.apartments;
    }
    modal.values.address_normalized = r.address;
  } catch (err) {
    geoSuggest.error = err?.message || String(err);
  } finally {
    geoSuggest.loading = false;
  }
}

function closeGeo() {
  clearTimeout(geoDebounce);
  geoSuggest.open = false;
  geoSuggest.results = [];
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

function openRelationForm() {
  if (creatingRelation.value) {
    return;
  }
  creatingRelation.value = true;
  const writable = relationTypes.value.filter((r) => auth.hasRelationWrite(r.code));
  relForm.relationType = writable[0]?.code || '';
  relForm.fromId = null;
  relForm.toId = null;
  relForm.attrsText = '';
  relForm.error = '';
  loadRelationFormOptions();
}

async function loadRelationFormOptions() {
  const rt = relationTypeByCode(relForm.relationType);
  if (!rt) {
    relationFromOptions.value = [];
    relationToOptions.value = [];
    return;
  }
  try {
    const [fromRes, toRes] = await Promise.all([
      api.objects.list({ type: rt.fromType.code }),
      api.objects.list({ type: rt.toType.code }),
    ]);
    relationFromOptions.value = fromRes;
    relationToOptions.value = toRes;
  } catch (err) {
    relForm.error = err?.message || String(err);
  }
}

function relationFormFromLabel(o) {
  return `${o.attrs?.inventory_number || o.attrs?.address || o.attrs?.device_type || ''} (#${o.id})`.trim();
}

async function submitRelationForm() {
  if (!relForm.relationType || relForm.fromId == null || relForm.toId == null) {
    relForm.error = 'Выберите тип связи и оба объекта';
    return;
  }
  let attrs = {};
  if (relForm.attrsText.trim()) {
    try {
      attrs = JSON.parse(relForm.attrsText);
    } catch {
      relForm.error = 'Атрибуты должны быть валидным JSON';
      return;
    }
  }
  try {
    await api.relations.create({
      relationType: relForm.relationType,
      fromId: Number(relForm.fromId),
      toId: Number(relForm.toId),
      attrs,
    });
    creatingRelation.value = false;
    reloadRelations();
  } catch (err) {
    relForm.error = err?.message || String(err);
  }
}

function cancelRelationForm() {
  creatingRelation.value = false;
  relForm.error = '';
}

async function openRelationModal(feature) {
  const props = feature?.properties || {};
  const id = props.id;
  if (id == null) {
    return;
  }
  const rt = relationTypeByCode(props.relationType);
  try {
    const relation = await api.relations.get(Number(id));
    relModal.open = true;
    relModal.relation = relation;
    relModal.relationTypeName = rt?.name || props.relationType;
    relModal.attrsText = JSON.stringify(relation.attrs || {}, null, 2);
    relModal.error = '';
  } catch (err) {
    console.error('failed to load relation', err);
  }
}

function closeRelationModal() {
  relModal.open = false;
  relModal.relation = null;
  relModal.error = '';
}

async function saveRelationAttrs() {
  if (!relModal.relation) {
    return;
  }
  let attrs;
  try {
    attrs = relModal.attrsText.trim() ? JSON.parse(relModal.attrsText) : {};
  } catch {
    relModal.error = 'Атрибуты должны быть валидным JSON';
    return;
  }
  relModal.saving = true;
  try {
    relModal.relation = await api.relations.update(relModal.relation.id, { attrs });
    relModal.attrsText = JSON.stringify(attrs, null, 2);
    reloadRelations();
  } catch (err) {
    relModal.error = err?.message || String(err);
  } finally {
    relModal.saving = false;
  }
}

async function removeRelation() {
  if (!relModal.relation) {
    return;
  }
  if (!window.confirm('Удалить связь?')) {
    return;
  }
  relModal.saving = true;
  try {
    await api.relations.remove(relModal.relation.id);
    closeRelationModal();
    reloadRelations();
  } catch (err) {
    relModal.error = err?.message || String(err);
  } finally {
    relModal.saving = false;
  }
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
  map.off('moveend', onMoveEnd);
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
  <div class="map-shell" :class="{ 'panel-open': panelOpen }">
    <div ref="mapContainer" class="map"></div>

    <button
      class="panel-toggle"
      :class="{ open: panelOpen }"
      @click="panelOpen = !panelOpen"
    >
      {{ panelOpen ? '✕' : '≡' }}
    </button>

    <aside class="panel" :class="{ 'panel-hidden': !panelOpen }">
      <div class="panel-header">
        <strong>{{ user?.name || user?.sub }}</strong>
        <div class="panel-header-actions">
          <button
            v-if="equipmentTypes.length"
            class="header-btn"
            :class="{ active: equipOpen }"
            :title="equipOpen ? 'Закрыть таблицу оборудования' : 'Таблица оборудования'"
            @click="equipOpen ? closeEquipment() : openEquipment()"
          >Оборудование</button>
          <button
            class="header-btn"
            :class="{ active: tableMode }"
            title="Таблица объектов в области обзора"
            @click="tableMode ? closeTable() : openTable()"
          >Таблица</button>
          <button class="logout" @click="logout">Выйти</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Поиск по объектам…"
            autocomplete="off"
            @input="onSearchInput"
          />
          <span v-if="searchLoading" class="search-hint">Поиск…</span>
          <div v-else-if="searchQuery.trim().length >= 2 && searchResults.length === 0" class="search-hint">
            Ничего не найдено
          </div>
          <div v-if="searchResults.length" class="search-results">
            <button
              v-for="o in searchResults"
              :key="o.id"
              class="search-item"
              type="button"
              @click="pickSearchResult(o)"
            >
              <span class="dot" :style="{ background: typeByCode(o.typeCode)?.color || '#888' }"></span>
              <span class="search-type">{{ typeByCode(o.typeCode)?.name || o.typeCode }}</span>
              <span class="search-label">{{ objectLabel(o) }}</span>
            </button>
          </div>
        </div>
          <div
            v-for="g in grouped"
            :key="g.code"
            class="layer-group"
          >
          <div
            class="layer-name"
            :class="{ collapsed: layerCollapsed[g.code] }"
            @click="toggleLayerCollapse(g)"
          >
            <span class="collapse-caret">{{ layerCollapsed[g.code] ? '▸' : '▾' }}</span>
            <span class="dot" :style="{ background: g.color || '#888' }"></span>
            {{ g.name }}
            <button
              v-if="!layerCollapsed[g.code] && auth.hasObjectRead(g.types[0].code)"
              class="list-toggle"
              :title="expandedLayers[g.code] ? 'Свернуть список' : 'Показать объекты слоя'"
              @click.stop="toggleLayerList(g)"
            >{{ expandedLayers[g.code] ? '−' : '≡' }}</button>
          </div>
          <template v-if="!layerCollapsed[g.code]">
          <div v-if="expandedLayers[g.code]" class="layer-list">
            <div v-if="layerObjectsLoading[g.code]" class="search-hint">Загрузка…</div>
            <div v-else-if="layerObjectsError[g.code]" class="search-hint search-error">{{ layerObjectsError[g.code] }}</div>
            <div v-else-if="!layerObjects[g.code]?.length" class="search-hint">
              Нет объектов в видимой области
            </div>
            <button
              v-for="o in layerObjects[g.code] || []"
              :key="o.id"
              class="search-item"
              type="button"
              @click="focusObject(o)"
            >
              <span class="dot" :style="{ background: typeByCode(o.typeCode)?.color || '#888' }"></span>
              <span class="search-type">{{ typeByCode(o.typeCode)?.name }}</span>
              <span class="search-label">{{ objectLabel(o) }}</span>
            </button>
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
          </template>
        </div>
        <div v-if="relationTypes.length" class="layer-group">
          <div class="layer-name">
            <span class="dot" :style="{ background: '#7c3aed' }"></span>
            Связи
            <button
              v-if="relationTypes.some((r) => auth.hasRelationWrite(r.code))"
              class="add-btn"
              :class="{ active: creatingRelation }"
              :disabled="creatingRelation"
              title="Добавить связь"
              @click="openRelationForm"
            >+</button>
          </div>
          <label
            v-for="r in relationTypes"
            :key="r.code"
            class="type-toggle"
          >
            <input
              type="checkbox"
              :checked="relationVisible[r.code]"
              :disabled="!auth.hasRelationRead(r.code)"
              @change="toggleRelation(r)"
            />
            <span class="dot" :style="{ background: relationColor(r) }"></span>
            {{ r.name }}
          </label>
        </div>
      </div>
      <div v-if="creatingRelation" class="draw-bar">
        <span>Новая связь</span>
        <button @click="cancelRelationForm">Отмена</button>
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

    <div v-if="fabOpen" class="fab-menu">
      <div class="fab-title">Добавить</div>
      <button
        v-for="t in types.filter((x) => auth.hasObjectWrite(x.code))"
        :key="t.code"
        class="fab-item"
        @click="startCreateFromFab(t)"
      >
        <span class="dot" :style="{ background: t.color || '#888' }"></span>
        {{ t.name }}
      </button>
      <button
        v-if="relationTypes.some((r) => auth.hasRelationWrite(r.code))"
        class="fab-item"
        @click="fabOpen = false; openRelationForm()"
      >
        <span class="dot" :style="{ background: '#7c3aed' }"></span>
        Связь
      </button>
    </div>
    <button class="fab" title="Добавить объект" @click="toggleFab">+</button>

    <ObjectsTable
      v-if="tableMode"
      :open="tableMode"
      :types="types"
      :bbox="bboxTick"
      @close="closeTable"
      @focus="focusFromTable"
    />

    <EquipmentTable
      v-if="equipOpen"
      :open="equipOpen"
      :types="equipmentTypes"
      :mode="equipMode"
      @close="closeEquipment"
      @focus="focusFromTable"
      @mode-change="onEquipModeChange"
    />

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
            <template v-if="f.widget === 'checkbox'">
              <input
                type="checkbox"
                class="field-checkbox"
                v-model="modal.values[f.key]"
              />
            </template>
            <div v-else-if="f.widget === 'geo'" class="geo-wrap">
              <input
                v-model="modal.values[f.key]"
                type="text"
                autocomplete="off"
                @input="onAddressInput"
              />
              <div v-if="geoSuggest.open" class="geo-suggest">
                <button
                  v-for="s in geoSuggest.results"
                  :key="s.value"
                  type="button"
                  class="geo-item"
                  @mousedown.prevent="pickAddress(s)"
                >{{ s.value }}</button>
              </div>
            </div>
            <select
              v-else-if="f.widget === 'select'"
              v-model="modal.values[f.key]"
            >
              <option v-for="opt in f.enum" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <textarea
              v-else-if="f.widget === 'textarea'"
              v-model="modal.values[f.key]"
              rows="3"
            ></textarea>
            <input
              v-else
              v-model="modal.values[f.key]"
              :type="f.widget === 'date' ? 'date' : (f.widget === 'number' ? 'number' : 'text')"
            />
          </label>
          <div
            v-if="isHouseModal() && isPointGeometry()"
            class="geo-tools"
          >
            <button
              type="button"
              class="secondary"
              :disabled="geoSuggest.loading"
              @click="reverseGeocode"
            >Определить адрес по точке</button>
            <span v-if="geoSuggest.loading" class="geo-loading">Поиск…</span>
          </div>
          <div v-if="geoSuggest.error" class="geo-error">{{ geoSuggest.error }}</div>
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
            <template v-if="f.widget === 'checkbox'">
              <input
                type="checkbox"
                class="field-checkbox"
                v-model="modal.values[f.key]"
              />
            </template>
            <div v-else-if="f.widget === 'geo'" class="geo-wrap">
              <input
                v-model="modal.values[f.key]"
                type="text"
                autocomplete="off"
                @input="onAddressInput"
              />
              <div v-if="geoSuggest.open" class="geo-suggest">
                <button
                  v-for="s in geoSuggest.results"
                  :key="s.value"
                  type="button"
                  class="geo-item"
                  @mousedown.prevent="pickAddress(s)"
                >{{ s.value }}</button>
              </div>
            </div>
            <select
              v-else-if="f.widget === 'select'"
              v-model="modal.values[f.key]"
            >
              <option v-for="opt in f.enum" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <textarea
              v-else-if="f.widget === 'textarea'"
              v-model="modal.values[f.key]"
              rows="3"
            ></textarea>
            <input
              v-else
              v-model="modal.values[f.key]"
              :type="f.widget === 'date' ? 'date' : (f.widget === 'number' ? 'number' : 'text')"
            />
          </label>
          <div
            v-if="isHouseModal() && isPointGeometry()"
            class="geo-tools"
          >
            <button
              type="button"
              class="secondary"
              :disabled="geoSuggest.loading"
              @click="reverseGeocode"
            >Определить адрес по точке</button>
            <span v-if="geoSuggest.loading" class="geo-loading">Поиск…</span>
          </div>
          <div v-if="geoSuggest.error" class="geo-error">{{ geoSuggest.error }}</div>
          <div v-if="modal.owner" class="owner-info">
            <div class="owner-row">
              <span>Создал:</span>
              <strong>{{ modal.owner.createdBy || '—' }}</strong>
              <span class="owner-date">{{ fmtDate(modal.owner.createdAt) }}</span>
            </div>
            <div class="owner-row">
              <span>Изменил:</span>
              <strong>{{ modal.owner.updatedBy || '—' }}</strong>
              <span class="owner-date">{{ fmtDate(modal.owner.updatedAt) }}</span>
            </div>
          </div>
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
            <button
              class="primary"
              :disabled="saving"
              @click="openHistory('object', modal.objectId, `История: ${modal.title}`)"
            >
              История
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="creatingRelation" class="modal-overlay" @click.self="cancelRelationForm">
      <div class="modal">
        <div class="modal-header">
          <strong>Новая связь</strong>
          <button class="modal-close" @click="cancelRelationForm">×</button>
        </div>
        <div v-if="relForm.error" class="modal-error">{{ relForm.error }}</div>
        <form class="modal-body" @submit.prevent="submitRelationForm">
          <label class="field">
            <span class="field-label">Тип связи</span>
            <select v-model="relForm.relationType" @change="loadRelationFormOptions">
              <option
                v-for="r in relationTypes.filter((x) => auth.hasRelationWrite(x.code))"
                :key="r.code"
                :value="r.code"
              >{{ r.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Источник ({{ relationTypeByCode(relForm.relationType)?.fromType?.name }})</span>
            <select v-model="relForm.fromId">
              <option
                v-for="o in relationFromOptions"
                :key="o.id"
                :value="o.id"
              >{{ relationFormFromLabel(o) }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Назначение ({{ relationTypeByCode(relForm.relationType)?.toType?.name }})</span>
            <select v-model="relForm.toId">
              <option
                v-for="o in relationToOptions"
                :key="o.id"
                :value="o.id"
              >{{ relationFormFromLabel(o) }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Атрибуты (JSON, необязательно)</span>
            <textarea v-model="relForm.attrsText" rows="3"></textarea>
          </label>
          <button type="submit" class="primary">Создать</button>
        </form>
      </div>
    </div>

    <div v-if="relModal.open" class="modal-overlay" @click.self="closeRelationModal">
      <div class="modal">
        <div class="modal-header">
          <strong>Связь: {{ relModal.relationTypeName }}</strong>
          <button class="modal-close" @click="closeRelationModal">×</button>
        </div>
        <div v-if="relModal.error" class="modal-error">{{ relModal.error }}</div>
        <div class="modal-body">
          <div class="rel-info">
            <div>#{{ relModal.relation?.id }} · {{ relModal.relation?.fromTypeCode }} #{{ relModal.relation?.fromId }} → {{ relModal.relation?.toTypeCode }} #{{ relModal.relation?.toId }}</div>
            <div class="owner-row">
              <span>Создал:</span>
              <strong>{{ relModal.relation?.createdBy || '—' }}</strong>
              <span class="owner-date">{{ fmtDate(relModal.relation?.createdAt) }}</span>
            </div>
          </div>
          <label class="field">
            <span class="field-label">Атрибуты (JSON)</span>
            <textarea v-model="relModal.attrsText" rows="6"></textarea>
          </label>
          <div class="modal-actions">
            <button
              v-if="relModal.relation && auth.hasRelationWrite(relModal.relation.relationTypeCode)"
              class="primary"
              :disabled="relModal.saving"
              @click="saveRelationAttrs"
            >Сохранить</button>
            <button
              v-if="relModal.relation && auth.hasRelationWrite(relModal.relation.relationTypeCode)"
              class="danger"
              :disabled="relModal.saving"
              @click="removeRelation"
            >Удалить</button>
            <button
              v-if="relModal.relation"
              class="primary"
              :disabled="relModal.saving"
              @click="openHistory('relation', relModal.relation.id, `История: ${relModal.relationTypeName}`)"
            >История</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="historyModal.open" class="modal-overlay" @click.self="closeHistory">
      <div class="modal modal-history">
        <div class="modal-header">
          <strong>{{ historyModal.title }}</strong>
          <button class="modal-close" @click="closeHistory">×</button>
        </div>
        <div v-if="historyModal.error" class="modal-error">{{ historyModal.error }}</div>
        <div class="modal-body">
          <div v-if="historyModal.loading" class="history-empty">Загрузка…</div>
          <div v-else-if="historyModal.entries.length === 0" class="history-empty">
            История пуста
          </div>
          <div v-else class="history-list">
            <div v-for="e in historyModal.entries" :key="e.id" class="history-entry">
              <div class="history-head">
                <strong>{{ ACTION_LABELS[e.action] || e.action }}</strong>
                <span class="owner-date">{{ fmtDate(e.createdAt) }}</span>
              </div>
              <div class="history-actor">{{ e.actor || '—' }}</div>
              <div
                v-if="e.changes?.attrs && Object.keys(e.changes.attrs).length"
                class="history-changes"
              >
                <div
                  v-for="(val, key) in e.changes.attrs"
                  :key="key"
                  class="history-change"
                >
                  <span class="history-key">{{ key }}</span>:
                  <span class="history-old">{{ fmtValue(val.before) }}</span>
                  → <span class="history-new">{{ fmtValue(val.after) }}</span>
                </div>
              </div>
              <div
                v-if="e.changes?.geometry"
                class="history-changes"
              >
                Геометрия изменена
              </div>
              <div
                v-if="e.action === 'created'"
                class="history-changes"
              >
                <div class="history-change" v-for="(val, key) in e.changes?.attrs" :key="key">
                  <span class="history-key">{{ key }}</span>:
                  <span class="history-new">{{ fmtValue(val) }}</span>
                </div>
              </div>
            </div>
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

.panel-toggle {
  display: none;
}

.search-box {
  position: relative;
  margin-bottom: 8px;
}

.search-box input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.search-hint {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 0;
}

.search-error {
  color: #991b1b;
}

.search-results {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 30;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  max-height: 240px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  padding: 7px 9px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}

.search-item:last-child {
  border-bottom: none;
}

.search-item:hover {
  background: #f3f4f6;
}

.search-type {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.search-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-toggle {
  margin-left: auto;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}

.list-toggle:hover {
  background: #e5e7eb;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 2px 0 6px 16px;
  max-height: 160px;
  overflow-y: auto;
}

.layer-list .search-item {
  border-bottom: none;
  padding: 5px 7px;
  border-radius: 4px;
  font-size: 12px;
}

.fab {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab:hover {
  background: #1f2937;
}

.fab-menu {
  position: absolute;
  right: 16px;
  bottom: 76px;
  width: 200px;
  max-height: 50vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  z-index: 3;
  padding: 6px;
}

.fab-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 4px 8px 6px;
}

.fab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: #111827;
  cursor: pointer;
}

.fab-item:hover {
  background: #f3f4f6;
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

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-btn {
  border: 1px solid #4b5563;
  background: transparent;
  color: #e5e7eb;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.header-btn:hover {
  background: #374151;
}

.header-btn.active {
  background: #fff;
  color: #111827;
  border-color: #fff;
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
  cursor: pointer;
  user-select: none;
}

.layer-name.collapsed {
  margin-bottom: 8px;
}

.collapse-caret {
  color: #9ca3af;
  font-size: 10px;
  flex: none;
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

.field textarea {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  resize: vertical;
}

.field .field-checkbox {
  width: auto;
  align-self: flex-start;
  padding: 0;
  border: none;
}

.geo-wrap {
  position: relative;
}

.geo-suggest {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 20;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  max-height: 180px;
  overflow-y: auto;
}

.geo-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
  cursor: pointer;
}

.geo-item:hover {
  background: #f3f4f6;
}

.geo-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-loading {
  font-size: 12px;
  color: #6b7280;
}

.geo-error {
  font-size: 12px;
  color: #991b1b;
}

.secondary {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}

.secondary:hover {
  background: #f9fafb;
}

.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rel-info {
  font-size: 13px;
  color: #374151;
  background: #f3f4f6;
  padding: 8px;
  border-radius: 6px;
}

.owner-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #374151;
  background: #f3f4f6;
  padding: 8px;
  border-radius: 6px;
}

.owner-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.owner-date {
  margin-left: auto;
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
}

.modal-history {
  width: 480px;
  max-width: calc(100% - 32px);
}

.history-empty {
  padding: 16px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.history-entry {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.history-actor {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.history-changes {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #374151;
  background: #f9fafb;
  border-radius: 4px;
  padding: 6px;
  word-break: break-word;
}

.history-change {
  line-height: 1.4;
}

.history-key {
  font-weight: 600;
}

.history-old {
  color: #b91c1c;
  text-decoration: line-through;
}

.history-new {
  color: #15803d;
}

.modal-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

@media (max-width: 700px) {
  .panel-toggle {
    display: flex;
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 4;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 8px;
    background: #111827;
    color: #fff;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .panel-toggle.open {
    background: #4b5563;
  }

  .panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: auto;
    max-height: 55vh;
    border-radius: 12px 12px 0 0;
    transition: transform 0.25s ease;
  }

  .panel.panel-hidden {
    transform: translateY(110%);
  }

  .fab {
    right: 12px;
    bottom: 12px;
  }

  .fab-menu {
    right: 12px;
    bottom: 72px;
  }

  .panel-open .fab,
  .panel-open .fab-menu {
    display: none;
  }

  .modal-overlay {
    align-items: stretch;
  }

  .modal {
    width: 100%;
    max-width: none;
    border-radius: 0;
  }

  .modal-history {
    width: 100%;
  }

  .history-list {
    max-height: calc(100vh - 160px);
  }

  .add-btn {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    font-size: 20px;
  }

  .type-toggle {
    min-height: 44px;
    padding: 4px 0;
  }

  .modal-actions button {
    min-height: 44px;
    flex: 1 1 100%;
  }

  .modal-actions {
    flex-direction: column;
  }

  .field input,
  .field select,
  .field textarea {
    font-size: 16px;
    min-height: 44px;
  }

  .field-checkbox {
    min-height: 44px;
  }

  .geo-item {
    padding: 12px 10px;
  }

  .secondary {
    min-height: 44px;
  }

  .search-box input {
    min-height: 44px;
    font-size: 16px;
  }

  .panel-header {
    padding: 8px 12px;
  }

  .header-btn {
    padding: 8px 10px;
    min-height: 40px;
  }

  .panel-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

</style>
