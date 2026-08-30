<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../api';
import { auth } from '../auth';

const mapContainer = ref(null);
const layers = ref([]);
const types = ref([]);
const visible = ref({});
const loading = ref(false);

let map = null;
let timer = null;

const grouped = computed(() =>
  layers.value
    .map((layer) => ({
      ...layer,
      types: types.value.filter((t) => t.layerId === layer.id),
    }))
    .filter((g) => g.types.length > 0),
);

const user = computed(() => auth.state.user);

function layerForType(t) {
  return `objects-${t.code}`;
}

function sourceForType(t) {
  return `src-${t.code}`;
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
  await fetchVisible();
}

function addObjectLayers() {
  for (const t of types.value) {
    const srcId = sourceForType(t);
    const layerId = layerForType(t);
    if (!map.getSource(srcId)) {
      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer(makeLayer(t));
    }
  }
}

function makeLayer(t) {
  const color = t.color || '#333333';
  const geom = t.geometryType;
  const layout = { visibility: visible.value[t.code] ? 'visible' : 'none' };
  const base = { id: layerForType(t), source: sourceForType(t), layout };
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

function bboxFromMap() {
  const b = map.getBounds();
  return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
}

async function fetchVisible() {
  const visibleTypes = types.value.filter((t) => visible.value[t.code]);
  if (visibleTypes.length === 0) {
    return;
  }
  loading.value = true;
  const bbox = bboxFromMap();
  const results = await Promise.allSettled(
    visibleTypes.map((t) => api.objects.list(t.code, bbox).then((rows) => ({ t, rows }))),
  );
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { t, rows } = r.value;
    const features = rows
      .filter((row) => row.geometry)
      .map((row) => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: { id: row.id, ...row.attrs },
      }));
    const source = map.getSource(sourceForType(t));
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
  }
  loading.value = false;
}

function onMoveEnd() {
  clearTimeout(timer);
  timer = setTimeout(fetchVisible, 400);
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
  if (visible.value[t.code]) {
    fetchVisible();
  }
}

function logout() {
  auth.logout();
}

onMounted(async () => {
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
    center: [37.605, 55.751],
    zoom: 14,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('moveend', onMoveEnd);

  map.on('load', loadCatalog);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
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
        <div v-if="loading" class="loading">Загрузка…</div>
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
          </label>
        </div>
      </div>
    </aside>
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

.loading {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 0;
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

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
</style>
