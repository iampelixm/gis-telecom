<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { api } from '../api';
import type { MapObject } from '../types';

const message = useMessage();
const dialog = useDialog();

const loading = ref(false);
const busy = ref(false);
const routes = ref<MapObject[]>([]);
const relations = ref<{ id: number; fromId: number; toId: number }[]>([]);
const search = ref('');
const expanded = ref<Set<string>>(new Set());
const attachFor = ref<string | null>(null);
const attachTarget = ref<number | null>(null);
const nameEdits = ref<Record<string, string>>({});

interface Seg {
  id: number;
  name: string;
  laying_type: string;
}

interface Chain {
  key: string;
  name: string;
  segments: Seg[];
  startId: number;
  endId: number;
}

async function load() {
  loading.value = true;
  try {
    const [objs, rels] = await Promise.all([
      api.objects.list({ type: 'route', limit: 5000 }),
      api.relations.list({ type: 'route_route', limit: 5000 }),
    ]);
    routes.value = objs;
    relations.value = (rels.features || []).map((f) => ({
      id: f.properties.id,
      fromId: f.properties.fromId,
      toId: f.properties.toId,
    }));
    nameEdits.value = {};
    attachFor.value = null;
    attachTarget.value = null;
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка загрузки');
  } finally {
    loading.value = false;
  }
}

const incomingBySegment = computed<Map<number, { id: number; fromId: number }[]>>(() => {
  const map = new Map<number, { id: number; fromId: number }[]>();
  for (const r of relations.value) {
    const list = map.get(r.toId) || [];
    list.push({ id: r.id, fromId: r.fromId });
    map.set(r.toId, list);
  }
  return map;
});

const outgoingBySegment = computed<Map<number, { id: number; toId: number }[]>>(() => {
  const map = new Map<number, { id: number; toId: number }[]>();
  for (const r of relations.value) {
    const list = map.get(r.fromId) || [];
    list.push({ id: r.id, toId: r.toId });
    map.set(r.fromId, list);
  }
  return map;
});

const chains = computed<Chain[]>(() => {
  const byId = new Map(routes.value.map((o) => [o.id, o]));
  const covered = new Set<number>();
  const result: Chain[] = [];
  const starts = routes.value
    .map((o) => o.id)
    .filter((id) => !incomingBySegment.value.has(id))
    .sort((a, b) => a - b);
  for (const s of starts) {
    const chain: Chain = { key: String(s), name: '', segments: [], startId: s, endId: s };
    let cur = s;
    while (cur && byId.has(cur) && !covered.has(cur)) {
      const o = byId.get(cur)!;
      covered.add(cur);
      chain.segments.push({
        id: o.id,
        name: String(o.attrs?.name || ''),
        laying_type: String(o.attrs?.laying_type || ''),
      });
      const next = (outgoingBySegment.value.get(cur) || [])[0];
      cur = next ? next.toId : 0;
    }
    if (chain.segments.length) {
      chain.endId = chain.segments[chain.segments.length - 1].id;
      chain.name =
        chain.segments.find((sg) => sg.name)?.name || 'Трасса без названия';
      result.push(chain);
    }
  }
  return result;
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return chains.value;
  return chains.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.segments.some((sg) => String(sg.id).includes(q)),
  );
});

const relationCount = computed(() => relations.value.length);

function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
  if (next.has(key) && nameEdits.value[key] === undefined) {
    const c = chains.value.find((x) => x.key === key);
    if (c) nameEdits.value[key] = c.name === 'Трасса без названия' ? '' : c.name;
  }
}

function beginAttach(key: string) {
  attachFor.value = key;
  attachTarget.value = null;
}

function cancelAttach() {
  attachFor.value = null;
  attachTarget.value = null;
}

function attachCandidates(chain: Chain) {
  const inChain = new Set(chain.segments.map((s) => s.id));
  return routes.value
    .filter((o) => !inChain.has(o.id) && !incomingBySegment.value.has(o.id))
    .map((o) => ({
      label: `#${o.id}${o.attrs?.name ? ' · ' + String(o.attrs.name) : ''}`,
      value: o.id,
    }))
    .sort((a, b) => a.value - b.value);
}

async function confirmAttach(chain: Chain) {
  if (!attachTarget.value) return;
  busy.value = true;
  try {
    await api.relations.create({
      relationType: 'route_route',
      fromId: chain.endId,
      toId: attachTarget.value,
    });
    message.success(`Сегмент #${attachTarget.value} присоединён к #${chain.endId}`);
    cancelAttach();
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка присоединения');
  } finally {
    busy.value = false;
  }
}

async function saveName(chain: Chain) {
  const nm = (nameEdits.value[chain.key] ?? '').trim();
  const changed = chain.segments.filter((sg) => (sg.name || '') !== nm);
  if (!changed.length) {
    message.info('Название не изменилось');
    return;
  }
  busy.value = true;
  try {
    for (const sg of changed) {
      await api.objects.update(sg.id, { attrs: { name: nm } });
    }
    message.success(`Название обновлено у ${changed.length} сегментов`);
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : 'Ошибка сохранения');
  } finally {
    busy.value = false;
  }
}

function detach(chain: Chain, index: number) {
  const sg = chain.segments[index];
  const rels = incomingBySegment.value.get(sg.id) || [];
  if (!rels.length) return;
  dialog.warning({
    title: 'Отвязать сегмент?',
    content: `Сегмент #${sg.id} будет отвязан от #${chain.segments[index - 1].id}`,
    positiveText: 'Отвязать',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      busy.value = true;
      try {
        for (const r of rels) await api.relations.remove(r.id);
        message.success(`Сегмент #${sg.id} отвязан`);
        await load();
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Ошибка отвязки');
      } finally {
        busy.value = false;
      }
    },
  });
}

function ungroup(chain: Chain) {
  if (chain.segments.length < 2) return;
  dialog.warning({
    title: 'Разгруппировать трассу?',
    content: `${chain.name} — ${chain.segments.length} сегментов станут независимыми`,
    positiveText: 'Разгруппировать',
    negativeText: 'Отмена',
    onPositiveClick: async () => {
      busy.value = true;
      try {
        const ids = new Set<number>();
        for (const sg of chain.segments) {
          for (const r of incomingBySegment.value.get(sg.id) || []) ids.add(r.id);
        }
        for (const id of ids) await api.relations.remove(id);
        message.success('Трасса разгруппирована');
        await load();
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Ошибка разгруппировки');
      } finally {
        busy.value = false;
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Трассы</h2>
      <n-space align="center">
        <span class="stats">трасс: {{ chains.length }} · сегментов: {{ routes.length }} · связей: {{ relationCount }}</span>
        <n-input
          v-model:value="search"
          placeholder="Поиск по названию или #id…"
          clearable
          style="width: 260px"
        />
        <n-button :loading="loading" @click="load">Обновить</n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <n-empty
        v-if="!loading && filtered.length === 0"
        description="Трассы не найдены"
        style="margin: 48px 0"
      />
      <div v-else class="chain-list">
        <div v-for="c in filtered" :key="c.key" class="chain-card">
          <div class="chain-head" @click="toggle(c.key)">
            <span class="chain-caret">{{ expanded.has(c.key) ? '▾' : '▸' }}</span>
            <span class="chain-name">{{ c.name }}</span>
            <n-tag size="small" type="info">#{{ c.startId }} → #{{ c.endId }}</n-tag>
            <n-tag size="small">{{ c.segments.length }}</n-tag>
          </div>

          <div v-if="expanded.has(c.key)" class="chain-body">
            <div class="chain-edit">
              <n-input
                :value="nameEdits[c.key] ?? c.name"
                placeholder="Название трассы (обновит все сегменты)"
                @update:value="(v: string) => (nameEdits[c.key] = v)"
                @keyup.enter="saveName(c)"
              />
              <n-button size="small" :disabled="busy" @click="saveName(c)">Сохранить название</n-button>
            </div>

            <div class="chain-attach">
              <template v-if="attachFor === c.key">
                <n-select
                  v-model:value="attachTarget"
                  :options="attachCandidates(c)"
                  filterable
                  placeholder="Сегмент без предыдущего…"
                  style="min-width: 280px"
                />
                <n-button size="small" type="primary" :disabled="!attachTarget || busy" @click="confirmAttach(c)">
                  Присоединить к #{{ c.endId }}
                </n-button>
                <n-button size="small" :disabled="busy" @click="cancelAttach">Отмена</n-button>
              </template>
              <n-button
                v-else
                size="small"
                type="primary"
                :disabled="busy || attachCandidates(c).length === 0"
                @click="beginAttach(c.key)"
              >
                Присоединить сегмент
              </n-button>
            </div>

            <div class="chain-segs">
              <div v-for="(sg, i) in c.segments" :key="sg.id" class="chain-seg">
                <span class="seg-arrow" v-if="i > 0">→</span>
                <span class="seg-id">#{{ sg.id }}</span>
                <span class="seg-name">{{ sg.name || '—' }}</span>
                <n-tag size="small" :type="sg.laying_type === 'aerial' ? 'warning' : 'default'">
                  {{ sg.laying_type || '—' }}
                </n-tag>
                <n-button
                  v-if="i > 0"
                  size="small"
                  :disabled="busy"
                  @click="detach(c, i)"
                >Отвязать</n-button>
              </div>
            </div>

            <div class="chain-actions">
              <n-button
                size="small"
                type="error"
                :disabled="busy || c.segments.length < 2"
                @click="ungroup(c)"
              >Разгруппировать</n-button>
            </div>
          </div>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar h2 {
  margin: 0;
}

.stats {
  color: #808080;
  font-size: 13px;
}

.chain-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.chain-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
}

.chain-head:hover {
  background: #f9fafb;
}

.chain-caret {
  width: 12px;
  color: #6b7280;
}

.chain-name {
  font-weight: 600;
}

.chain-body {
  border-top: 1px solid #f3f4f6;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chain-edit,
.chain-attach {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chain-edit .n-input {
  flex: 1;
}

.chain-segs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chain-seg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
}

.chain-seg:hover {
  background: #f9fafb;
}

.seg-arrow {
  color: #9ca3af;
}

.seg-id {
  font-variant-numeric: tabular-nums;
  color: #374151;
  font-weight: 600;
  min-width: 44px;
}

.seg-name {
  color: #6b7280;
  flex: 1;
}
</style>
