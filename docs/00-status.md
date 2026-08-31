# Статус проекта (сжато)

Последнее обновление: 2026-08-31 (синхронизировано с фактическим состоянием кода)

## Суть

GIS-сервис для интернет-провайдера: веб-приложение, где сетевой инженер отмечает на карте столбы, линии оптики, трассы, дома абонентов, активное оборудование. Всё в Docker.

## Стек (решено)

| Область | Решение |
|---------|---------|
| Карта | MapLibre GL + векторные тайлы (Martin) |
| Бэкенд | Node.js + NestJS (REST, OpenAPI) |
| Фронтенд | Vue 3 + Vite |
| БД | PostgreSQL + PostGIS |
| Аутентификация | Внешний сервис пользователей (не подключаем). Сейчас mock-auth (заглушка, выдаёт JWT). |
| Миграции БД | TypeORM migrations |
| Рисование на карте | maplibre-gl-geoman |
| Прокси | Nginx |
| OSM | растр (dev) → self-hosted ЮФО (прод, tilemaker→.mbtiles→Martin) |
| Геокодирование | Отдельный сервис geo (NestJS) + Dadata; кэш Redis; mock до ключей (docs/02-architecture/geocoding.md) |

## Сервисы (работают)

`proxy`(:80) → `web`(:80), `admin`(:80), `api`(:3000), `mock-auth`(:3100); `db` PostGIS(:5432); `tiles` — Martin v1.14.0 (самосбор, MVT, :3200); `geo`(NestJS, :3300) + `redis` — фаза 6, mock-режим до ключей Dadata.

Маршруты через proxy: `/api/*` → api, `/mock-auth/*` → mock-auth, `/geo/*` → geo, `/admin/` → admin (SPA администратора), `/tiles/objects/{z}/{x}/{y}` → tiles (JWT-фильтр, auth_request), `/` → web (карта инженера).

Тестовые пользователи mock-auth: `admin` (всё + object-types:manage), `engineer` (read/write по всем объектам), `viewer` (только read).

## Ключевая идея архитектуры

**Справочно-ориентированная модель (ADR-001):** типы объектов — не код, а данные.
`layers` → `object_types` (с аттрибут-схемой `attrs_schema` JSON Schema) → `objects` (JSONB attrs), + `relation_types` → `object_relations`.

Права динамические, из JWT-claims: `objects:<code>:read|write`, `object-relations:<code>:read|write`, `object-types:manage`.

## Формат JWT

Claims: `sub` (user), `name`, `role`, `permissions[]`. Подписан общим с mock-auth секретом (`JWT_SECRET`).

## Текущее состояние фаз

- Фаза 0 (план): ✅ (документация в docs/)
- Фаза 1 (скелет): ✅ — весь стек работает, цепочка JWT проверена
- Фаза 2 (ядро): ✅ — 2.1 ✅ (миграции БД + seed), 2.2 ✅ (generic-CRUD объектов), 2.3 ✅ (отдельное приложение `admin` + CRUD справочников), 2.4 ✅ (Martin v1.14.0 + MVT + фильтр по правам), 2.5 ✅ (web: карта со слоями из каталога + OSM-растр), 2.6 ✅ (переключатель слоёв по правам)
- Фаза 3 (RBAC): ✅ — 3.1 ✅ (`ObjectPermissionGuard` на `/objects`, `PermissionsGuard` на каталоге), 3.2 ✅ (видимость слоёв по правам в web и тайлах), 3.3 ✅ (mock-auth: admin/engineer/viewer)
- Фаза 4 (редактирование и UX): ✅ — 4.1 ✅ (geoman: создание/перемещение/правка геометрии/удаление), 4.2 ✅ (динамические формы атрибутов по attrs_schema: text/number/integer/enum/checkbox/date/textarea), 4.3 ✅ (структурный редактор attrs_schema в admin: AttrsSchemaEditor.vue + режим сырого JSON), 4.4 ✅ (CRUD связей объектов: `/relations` + слой связей на карте, см. roadmap)
- Фаза 5 (резервное копирование и полировка): частично — 5.1 бэкап ⬜ (план: Velero + restic + внешний S3, ежедневно, TTL 30 дней — docs/02-architecture/backup.md), 5.2 TLS ✅ (обеспечивает кластер summersite: Traefik + cert-manager), 5.3 аудит ✅ (журнал `change_log`: создание/изменение/перемещение/удаление объектов и связей + модалка «История» и хозяин объекта в web). OSM self-hosted вынесен в TODO (бэклог). Целевая среда проекта — кластер `summersite` (k3s).
- Фаза 6 (geo + Dadata): ✅ (mock-режим) — сервис `geo` (NestJS, эндпоинты /geo/health|suggest|forward|reverse|company), Redis-кэш, JWT общим секретом, `/geo/` в nginx, контейнеры geo+redis в compose; в web — автоподсказки адреса в форме дома (suggest) + «Определить адрес по точке» (reverse), расширение `attrsSchema` типа `house` (fias_id, kladr_id, address_normalized, floors, apartments). Реальные ключи Dadata — после предоставления (`GEO_PROVIDER=dadata`).
- Фаза 7 (UX-полировка и мобильные): ✅ — поиск по объектам (`GET /objects?search=` + поле поиска в панели web), список объектов слоя в текущем bbox (кнопка «≡»), FAB «+» для быстрого добавления, адаптив: панель → bottom-sheet, модалки на весь экран, тач-таргеты ≥44px.

## Ближайшие задачи (по порядку)

1. Подключение Dadata: вставить ключи в .env, `GEO_PROVIDER=dadata`, сверить формат ответов.
2. Развёртывание d_map в кластер `summersite` (k3s) и резервное копирование (Velero + restic + внешний S3, ежедневно, 30 дней — план: docs/02-architecture/backup.md).

## Полезные команды

```bash
docker compose up -d --build     # собрать и поднять
docker compose ps                # статус
docker compose logs -f api       # логи
curl http://localhost/api/health # health api
# логин engineer:
curl -X POST http://localhost/mock-auth/login -H 'Content-Type: application/json' -d '{"username":"engineer"}'
# демо-данные на карту (ул. Макаренко, Сочи; только dev):
docker compose exec -T db psql -U gis -d gis < infra/db/demo-seed.sql
```

## Открытые вопросы

- Домен для TLS (фаза 5).
- Разграничение прав по территориям (заявлено как возможное, пока не реализуем).
- Внешний доступ с сервера нестабилен (Geofabrik 503, maplibre таймауты) — проверить исходящий HTTPS перед подключением Dadata.

## Ресурсы сервера (проверено)

- RAM 11 ГБ: текущие контейнеры ~100 МБ, свободно ~9.5 ГБ — запас на Martin, Redis, geo.
- Диск ~52 ГБ свободно — хватает на OSM PBF ЮФО + `.mbtiles`.
