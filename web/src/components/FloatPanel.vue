<script setup>
import { ref } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  dock: { type: String, default: 'float' }, // 'left' | 'right' | 'float'
  pos: { type: Object, default: () => ({ x: 10, y: 10 }) },
  open: { type: Boolean, default: true },
  width: { type: [Number, String], default: 260 },
  closable: { type: Boolean, default: false },
});

const emit = defineEmits(['update:dock', 'update:pos', 'update:open', 'close']);

const el = ref(null);
let dragState = null;

function panelStyle() {
  const style = { width: props.width };
  if (props.dock === 'float') {
    style.left = `${props.pos.x}px`;
    style.top = `${props.pos.y}px`;
  }
  return style;
}

function startDrag(e) {
  if (e.button !== 0 || window.innerWidth <= 700) return;
  if (e.target.closest('button, input, a, .panel-toggle, .float-panel-close')) return;
  const panel = el.value;
  if (!panel) return;
  const rect = panel.getBoundingClientRect();
  dragState = { startX: e.clientX, startY: e.clientY, x: rect.left, y: rect.top };
  emit('update:dock', 'float');
  emit('update:pos', { x: rect.left, y: rect.top });
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  emit('update:pos', {
    x: dragState.x + (e.clientX - dragState.startX),
    y: dragState.y + (e.clientY - dragState.startY),
  });
}

function onDragEnd() {
  if (!dragState) return;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  const vw = window.innerWidth;
  const panel = el.value;
  const w = panel ? panel.offsetWidth : 240;
  const p = props.pos;
  if (p.x <= 24) {
    emit('update:dock', 'left');
  } else if (p.x + w >= vw - 24) {
    emit('update:dock', 'right');
  }
  dragState = null;
}

function close() {
  emit('close');
  emit('update:open', false);
}
</script>

<template>
  <aside
    v-if="open"
    ref="el"
    class="float-panel"
    :class="'dock-' + dock"
    :style="panelStyle()"
  >
    <div class="float-panel-header" @mousedown="startDrag">
      <strong
        class="float-panel-title"
        :title="dragState ? '' : 'Перетащите панель или закрепите по краю'"
      >{{ title }}</strong>
      <div class="float-panel-actions">
        <slot name="header-actions" />
        <button
          v-if="closable"
          class="float-panel-close"
          type="button"
          title="Закрыть"
          @click="close"
        >×</button>
      </div>
    </div>
    <div class="float-panel-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="float-panel-footer">
      <slot name="footer" />
    </div>
  </aside>
</template>

<style scoped>
.float-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1;
  max-height: calc(100% - 20px);
}

.float-panel.dock-left {
  top: 10px;
  left: 10px;
}

.float-panel.dock-right {
  top: 10px;
  left: auto;
  right: 10px;
}

.float-panel.dock-float {
  top: auto;
  left: auto;
}

.float-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 12px;
  background: #111827;
  color: #fff;
  font-size: 14px;
  cursor: grab;
  user-select: none;
  flex: none;
}

.float-panel-header:active {
  cursor: grabbing;
}

.float-panel-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.float-panel-close {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.float-panel-close:hover {
  color: #fff;
}

.float-panel-body {
  overflow-y: auto;
  flex: 1;
}

.float-panel-footer {
  flex: none;
}

@media (max-width: 700px) {
  .float-panel,
  .float-panel.dock-left,
  .float-panel.dock-right,
  .float-panel.dock-float {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: auto !important;
    max-height: 55vh;
    border-radius: 12px 12px 0 0;
    transition: transform 0.25s ease;
  }
}
</style>
