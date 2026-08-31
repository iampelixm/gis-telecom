# Roadmap

Легенда статусов: ⬜ не начато | 🟡 в работе | ✅ готово | 🚫 отложено

## Фаза 0. Планирование и документация

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 0.1 | Исходное задание | ✅ | docs/01-tasks/initial-task.md |
| 0.2 | Сервисная архитектура (черновик) | ✅ | docs/02-architecture/services.md |
| 0.3 | Каталог объектов и слоёв (справочная модель) | ✅ | docs/03-objects/object-catalog.md |
| 0.4 | Модель доступа (роли, permissions) | ✅ | docs/04-access/access-model.md |
| 0.5 | Формат JWT и claims | ✅ | docs/04-access/access-model.md |
| 0.6 | Выбор proxy (Nginx) и схема маршрутизации | ✅ | реализовано: /api, /mock-auth, / → web |
| 0.7 | Схема БД (таблицы, геометрии, индексы) | ✅ | миграции реализованы в 2.1 |
| 0.8 | OSM-подложка: план | ✅ | docs/02-architecture/map-basemap.md |

## Фаза 1. Скелет проекта (Docker Compose)

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 1.1 | Структура репозитория (монорепо: web/, api/, mock-auth/, infra/) | ✅ | |
| 1.2 | docker-compose.yml: db + PostGIS | ✅ | healthcheck, инициализация PostGIS |
| 1.3 | mock-auth: выдача JWT тестовым пользователям | ✅ | admin/engineer/viewer |
| 1.4 | api: каркас NestJS, healthcheck, проверка JWT | ✅ | /api/health, /api/me, PermissionsGuard |
| 1.5 | proxy: маршрутизация между сервисами | ✅ | /api, /mock-auth, / — web |
| 1.6 | web: каркас Vue 3 + MapLibre, пустая карта | ✅ | |

## Фаза 2. Ядро: объекты и слои

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 2.1 | Миграции БД: справочники (layers, object_types, relation_types) + objects + object_relations + seed | ✅ | TypeORM, geometry(4326)+GIST, 5 слоёв/6 типов/4 связи |
| 2.2 | Generic-CRUD объектов в api (по типам из справочника) + валидация attrs_schema | ✅ | raw SQL (ST_AsGeoJSON/ST_GeomFromGeoJSON), ajv-валидация attrs, ObjectPermissionGuard |
| 2.3 | Отдельное приложение `admin` (Vue 3 + TS + Naive UI, `/admin/`) + CRUD справочников в api (типы, слои, типы связей) | ✅ | доступ по `object-types:manage`; duplicate → 409 |
| 2.4 | tiles: Martin + MVT с фильтром по правам (JWT-claims → request.jwt.claims) | ✅ | Martin v1.14.0 (самосбор без features rendering), nginx auth_request → /api/me → X-Object-Types → SQL-функция tiles_objects(z,x,y,query_params json), ST_AsMVT; web переведён на векторный source |
| 2.5 | web: карта со слоями из справочника + подложка OSM-растр (dev) | ✅ | login (mock-auth) → MapLibre, слои по типам из каталога, OSM-растр + атрибуция; GET-каталог открыт аутентифицированным, мутации — `object-types:manage` |
| 2.6 | web: переключатель видимости слоёв (по правам) | ✅ | панель слоёв в web, чекбоксы по типам, недоступные по правам — disabled |

## Фаза 3. Доступ (RBAC)

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 3.1 | Guard в api по динамическим permissions (objects/object-relations/types) | ✅ | `ObjectPermissionGuard` на всех эндпоинтах `/objects` (read/write по коду типа), `PermissionsGuard` + `object-types:manage` на мутациях каталога |
| 3.2 | Видимость слоёв по правам (api + web) | ✅ | web скрывает чекбоксы и кнопки создания без прав (auth.js), тайлы фильтруются по `X-Object-Types` (ADR-002) |
| 3.3 | mock-auth: набор пользователей с разными permissions | ✅ | admin/engineer/viewer, готово в фазе 1 |

## Фаза 4. Редактирование и UX

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 4.1 | Инструменты рисования/редактирования на карте | ✅ | **maplibre-gl-geoman**: создание кликом, перемещение, правка геометрии, удаление; выбор объекта с приоритетом point > line > polygon; `--cache-expiry 5s` у Martin для быстрой инвалидации тайлов |
| 4.2 | Динамические формы атрибутов по attrs_schema | ✅ | поля из `attrsSchema` в web: text/number/integer/enum + **checkbox (boolean), date (format:date), textarea (format:textarea или minLength≥100)** |
| 4.3 | Редактор attrs_schema в админке `admin` | ✅ | `AttrsSchemaEditor.vue`: структурный редактор полей (имя, виджет, enum, min/max, обязательное) + переключатель на сырой JSON |
| 4.4 | CRUD связей объектов на карте | ✅ | `RelationsModule` (GET list GeoJSON по bbox / GET /:id / POST / PATCH / DELETE), `RelationPermissionGuard` по `object-relations:<code>:read|write`; web: слой связей GeoJSON (dashed-линии по типам, видимость по правам), форма создания (тип → источник → назначение), клик по линии → свойства/удаление; валидация типов концов по fromType/toType |

## Фаза 5. Резервное копирование и полировка

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 5.1 | Резервное копирование (Velero + restic + S3, ежедневно, 30 дней) | ⬜ | схема в docs/02-architecture/backup.md; целевая среда — кластер summersite (k3s) |
| 5.2 | TLS/HTTPS | ✅ | на текущем этапе TLS обеспечивает кластер (Traefik + cert-manager); отдельный TLS на compose-прокси не требуется |
| 5.3 | Аудит изменений (история) | ✅ | таблица `change_log` (без FK), записи создание/изменение/перемещение/удаление объектов и связей; эндпоинты `/objects/:id/history`, `/relations/:id/history`, `/history?entityType=&entityId=` (работает и после удаления, права по типу); в web — модалка «История» и хозяин объекта (создал/изменил). Схема: docs/02-architecture/audit.md |

## TODO (бэклог, вне фаз)

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| T.1 | Self-hosted OSM ЮФО (tilemaker → .mbtiles → Martin) | ⬜ | map-basemap.md |
| T.2 | Развёртывание d_map в кластер summersite (k3s) | ⬜ | целевая среда кластера; конвертация compose → Kubernetes-манифесты |

## Фаза 6. Геокодирование (geo + Dadata)

Отдельный сервис `geo` (NestJS), кэш в Redis, mock-режим до получения ключей. Детали: docs/02-architecture/geocoding.md.

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 6.1 | geo: каркас NestJS + JWT (общий JWT_SECRET) + /geo/health | ✅ | `geo/src/auth/*`, `/geo/health` без JWT |
| 6.2 | geo: mock-эндпоинты (suggest/forward/reverse/company) | ✅ | `MockProvider`, заготовленные адреса Сочи |
| 6.3 | compose: сервис geo + Redis; nginx: /geo/* → geo | ✅ | контейнеры dmap-geo/dmap-redis, `location /geo/` |
| 6.4 | geo: кэш-логика (Redis), защита квоты Dadata | ✅ | TTL 7 дней, in-memory fallback, JWT-гвард на все эндпоинты кроме health |
| 6.5 | geo: провайдер Dadata + проверка исходящего HTTPS | ✅ | ключи подключены; важно: хост `suggestions.dadata.ru` (не `suggest.dadata.ru` — QRATOR отдаёт 301/HTML); suggest/forward/reverse/company проверены E2E |
| 6.6 | web: подсказки адресов, обратное геокодирование; расширение attrs_schema house | ✅ | автоподсказки address (suggest), «Определить адрес по точке» (reverse); миграция `1700000000005-house-geo-attrs` (fias_id, kladr_id, address_normalized, floors, apartments) |

## Фаза 7. UX-полировка и мобильные

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 7.1 | Поиск по объектам | ✅ | `GET /objects?search=` (ILIKE по attrs + точное совпадение id), web: поле поиска в панели с выпадающим списком результатов (debounce 300 мс, до 30 результатов), клик — перелёт к объекту и открытие свойств |
| 7.2 | Список объектов слоя | ✅ | web: кнопка «≡» у слоя раскрывает список объектов в текущем bbox (до 500 на тип), клик — перелёт + свойства; обновляется при раскрытии |
| 7.3 | FAB «+» | ✅ | плавающая кнопка добавления (для мобильных; скрыта при открытой панели), меню с типами объектов и «Связь» |
| 7.4 | Адаптив под мобильные | ✅ | панель-панель → bottom-sheet (max-height 55vh, скрывается кнопкой «≡»/«✕»), модалки на всю ширину/высоту, тач-таргеты ≥44px (поля, кнопки, чекбоксы, гео-подсказки) |
