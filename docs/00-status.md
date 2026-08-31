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

`proxy`(:80) → `web`(:80), `admin`(:80), `api`(:3000), `mock-auth`(:3100); `db` PostGIS(:5432); `tiles` — Martin v1.14.0 (самосбор, MVT, :3200); geo + Redis — фаза 6.

Маршруты через proxy: `/api/*` → api, `/mock-auth/*` → mock-auth, `/admin/` → admin (SPA администратора), `/tiles/objects/{z}/{x}/{y}` → tiles (JWT-фильтр, auth_request), `/` → web (карта инженера).

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
- Фаза 4 (редактирование и UX): частично — 4.1 ✅ (geoman: создание/перемещение/правка геометрии/удаление), 4.2 🟡 (базовые формы атрибутов из attrs_schema), 4.3 🟡 (attrs_schema в admin как JSON-textarea), 4.4 ✅ (CRUD связей объектов: `/relations` + слой связей на карте, см. roadmap)
- Фаза 5 (OSM self-hosted, бэкап, TLS): не начата
- Фаза 6 (geo + Dadata): запланирована, строится после фазы 4

## Ближайшие задачи (по порядку)

1. Завершить фазу 4: 4.3 — структурный редактор attrs_schema в admin; 4.2 — расширить типы полей форм. (4.4 CRUD связей объектов реализован: эндпоинты `/relations` + отрисовка/создание/удаление на карте; при росте объёмов — перенос связей на MVT-тайлы, сейчас GeoJSON по bbox.)
2. Фаза 5: self-hosted OSM ЮФО (tilemaker → .mbtiles → Martin), бэкап БД, TLS/HTTPS.
3. Фаза 6: сервис `geo` (NestJS) + Redis + Dadata (mock-режим до ключей), подсказки адресов в web.

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
- Аудит изменений (история) — по требованию.
- Разграничение прав по территориям (заявлено как возможное, пока не реализуем).
- Внешний доступ с сервера нестабилен (Geofabrik 503, maplibre таймауты) — проверить исходящий HTTPS перед подключением Dadata.

## Ресурсы сервера (проверено)

- RAM 11 ГБ: текущие контейнеры ~100 МБ, свободно ~9.5 ГБ — запас на Martin, Redis, geo.
- Диск ~52 ГБ свободно — хватает на OSM PBF ЮФО + `.mbtiles`.
