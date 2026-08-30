<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapContainer = ref(null);
let map = null;

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {},
      layers: [],
    },
    center: [37.6173, 55.7558],
    zoom: 10,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
});

onBeforeUnmount(() => {
  map?.remove();
});
</script>

<template>
  <div ref="mapContainer" class="map"></div>
</template>

<style scoped>
.map {
  width: 100%;
  height: 100vh;
}
</style>
