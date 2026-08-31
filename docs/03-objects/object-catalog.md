# Каталог объектов

Статус: реализовано (миграции + seed + ADR-001)
Дата: 2026-08-31

Справочно-ориентированная архитектура: типы объектов, слои и связи описываются данными, а не кодом. См. ADR-001.

## Модель данных

### `layers` — справочник слоёв

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK |
| code | text | машинное имя (уникально), напр. `optics` |
| name | text | отображаемое имя |
| color | text | базовый цвет слоя |
| icon | text | иконка для маркеров |
| sort_order | int | порядок в переключателе |
| is_active | bool | виден ли в переключателе |

Один слой может объединять несколько типов объектов. Переключатель видимости на карте строится по `layers`.

### `object_types` — справочник типов объектов

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK |
| code | text | машинное имя (уникально), напр. `pole` |
| name | text | отображаемое имя |
| layer_id | int FK -> layers | слой, к которому относится тип |
| geometry_type | enum | `point` / `linestring` / `polygon` (+ мульти-варианты) |
| color | text | цвет отображения |
| icon | text | иконка/символ |
| line_width | int | толщина линии (для линий) |
| attrs_schema | jsonb | JSON Schema атрибутов типа |
| is_active | bool | активен ли тип |
| sort_order | int | порядок внутри слоя |

### `objects` — единая таблица объектов

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK (SERIAL) |
| object_type_id | int FK -> object_types | тип объекта |
| geometry | geometry | геометрия (по `geometry_type` типа) |
| attrs | jsonb | атрибуты, валидируются по `attrs_schema` типа |
| created_by | text | user_id из JWT |
| updated_by | text | user_id из JWT |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `relation_types` — справочник типов связей

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK |
| code | text | машинное имя, напр. `fiber_line_pole` |
| name | text | отображаемое имя |
| from_type_id | int FK -> object_types | тип объекта-источника |
| to_type_id | int FK -> object_types | тип объекта-назначения |
| is_active | bool | |

### `object_relations` — связи объектов

| Поле | Тип | Описание |
|------|-----|----------|
| id | int | PK (SERIAL) |
| relation_type_id | int FK -> relation_types | тип связи |
| from_object_id | int FK -> objects | объект-источник |
| to_object_id | int FK -> objects | объект-назначение |
| attrs | jsonb | атрибуты связи (например, номер сварного соединения) |
| created_by | text | |
| created_at | timestamptz | |

## Формат `attrs_schema`

JSON Schema (Draft 2020-12), валидация в `api` через `ajv`.

Пример для `pole` (столб):

```json
{
  "type": "object",
  "required": ["inventory_number"],
  "properties": {
    "inventory_number": { "type": "string" },
    "material": { "enum": ["wood", "concrete", "metal"] },
    "height_m": { "type": "number", "minimum": 1 }
  },
  "additionalProperties": true
}
```

## Seed-данные справочника (первичный набор)

### Слои

| code | name |
|------|------|
| `poles` | Столбы |
| `optics` | Оптика |
| `routes` | Трассы |
| `houses` | Дома абонентов |
| `equipment` | Активное оборудование |

### Типы объектов

| code | name | layer | geometry | пример атрибутов |
|------|------|-------|----------|------------------|
| `pole` | Столб | poles | point | материал, высота, инв. номер |
| `fiber_line` | Линия оптики | optics | linestring | число волокон, тип кабеля, статус |
| `splice` | Муфта | optics | point | тип, число сварных соединений |
| `route` | Трасса | routes | linestring | тип прокладки, глубина |
| `house` | Дом абонента | houses | point | адрес, число абонентов |
| `equipment` | Активное оборудование | equipment | point | тип устройства, модель, порты, IP |

### Типы связей

| code | name | from | to |
|------|------|------|-----|
| `fiber_line_pole` | Линия → столб | fiber_line | pole |
| `fiber_line_house` | Линия → дом | fiber_line | house |
| `equipment_house` | Оборудование → дом | equipment | house |
| `equipment_pole` | Оборудование → столб | equipment | pole |

## Открытые вопросы

- Тайлы и права — решено: ADR-002 (nginx `auth_request` → `/api/me` → `X-Object-Types` → `types` в SQL-функции).
- Мульти-геометрии: API уже принимает `multipoint`/`multilinestring`/`multipolygon` (`GEOJSON_TO_GEOMETRY_TYPE`), в seed используются базовые.
- Нужна ли мягкое удаление (`deleted_at`) объектов для истории.
